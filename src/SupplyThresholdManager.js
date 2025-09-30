// SupplyThresholdManager.js - Enhanced Real-time threshold-based status monitoring
class SupplyThresholdManager {
  constructor() {
    // Default thresholds - can be customized per category or item
    this.defaultThresholds = {
      understock: 10,    // Below this = Understock
      overstock: 100     // Above this = Overstock
    };

    // Category-specific thresholds (simplified for 3 levels)
    this.categoryThresholds = {
      'Office Supply': {
        understock: 5,
        overstock: 50
      },
      'Sanitary Supply': {
        understock: 15,
        overstock: 200
      },
      'Construction Supply': {
        understock: 20,
        overstock: 500
      },
      'Electrical Supply': {
        understock: 8,
        overstock: 80
      }
    };

    // NEW: Real-time monitoring settings
    this.monitoringSettings = {
      enableRealTimeUpdates: true,
      notificationThreshold: 'critical', // 'critical', 'understock', 'all'
      autoRecalculate: true,
      historyTracking: true
    };

    // NEW: Status change history for analytics
    this.statusHistory = new Map();

    // Item-specific thresholds (override category defaults)
    this.itemThresholds = new Map();
    
    // Load saved thresholds from localStorage
    this.loadSavedThresholds();
  }

  // Load thresholds from localStorage
  loadSavedThresholds() {
    try {
      const savedThresholds = localStorage.getItem('supplyThresholds');
      if (savedThresholds) {
        const parsed = JSON.parse(savedThresholds);
        this.categoryThresholds = { ...this.categoryThresholds, ...parsed.categoryThresholds };
        this.itemThresholds = new Map(parsed.itemThresholds || []);
      }
    } catch (error) {
      console.warn('Failed to load saved thresholds:', error);
    }
  }

  // Save thresholds to localStorage
  saveThresholds() {
    try {
      const thresholdsData = {
        categoryThresholds: this.categoryThresholds,
        itemThresholds: Array.from(this.itemThresholds.entries())
      };
      localStorage.setItem('supplyThresholds', JSON.stringify(thresholdsData));
    } catch (error) {
      console.warn('Failed to save thresholds:', error);
    }
  }

  // Get thresholds for a specific item
  getThresholds(item) {
    const itemKey = `${item.itemCode}_${item.itemName}`;
    
    // Check for item-specific thresholds first
    if (this.itemThresholds.has(itemKey)) {
      return this.itemThresholds.get(itemKey);
    }
    
    // Check for category-specific thresholds
    if (this.categoryThresholds[item.category]) {
      return this.categoryThresholds[item.category];
    }
    
    // Fall back to default thresholds
    return this.defaultThresholds;
  }

  // Set custom thresholds for a specific item
  setItemThresholds(item, thresholds) {
    const itemKey = `${item.itemCode}_${item.itemName}`;
    this.itemThresholds.set(itemKey, {
      understock: thresholds.understock || this.defaultThresholds.understock,
      overstock: thresholds.overstock || this.defaultThresholds.overstock
    });
    this.saveThresholds();
  }

  // Set thresholds for a category
  setCategoryThresholds(category, thresholds) {
    this.categoryThresholds[category] = {
      understock: thresholds.understock || this.defaultThresholds.understock,
      overstock: thresholds.overstock || this.defaultThresholds.overstock
    };
    this.saveThresholds();
  }

  // Status calculation with 3 levels: Understock, Normal, Overstock
  calculateStatus(item) {
    const quantity = parseInt(item.quantity) || 0;
    const thresholds = this.getThresholds(item);
    
    // Simplified 3-level status system
    if (quantity <= thresholds.understock) {
      return 'Understock';
    } else if (quantity >= thresholds.overstock) {
      return 'Overstock';
    } else {
      return 'Normal';
    }
  }

  // NEW: Calculate detailed status with percentage and trend (3 levels only)
  calculateDetailedStatus(item) {
    const quantity = parseInt(item.quantity) || 0;
    const thresholds = this.getThresholds(item);
    const status = this.calculateStatus(item);
    
    // Calculate percentage of optimal stock (midpoint between understock and overstock)
    const optimal = (thresholds.understock + thresholds.overstock) / 2;
    const percentage = Math.round((quantity / optimal) * 100);
    
    // Determine trend based on recent history
    const trend = this.calculateTrend(item);
    
    // Calculate urgency level
    const urgency = this.calculateUrgency(item);
    
    return {
      status,
      quantity,
      percentage,
      trend,
      urgency,
      thresholds,
      recommendations: this.getStatusRecommendations(item, status, quantity, thresholds)
    };
  }

  // NEW: Calculate trend based on recent changes
  calculateTrend(item) {
    const itemKey = `${item.itemCode}_${item.itemName}`;
    const history = this.statusHistory.get(itemKey) || [];
    
    if (history.length < 2) return 'stable';
    
    const recent = history.slice(-3); // Last 3 changes
    const quantities = recent.map(h => h.quantity);
    
    if (quantities.every((q, i) => i === 0 || q > quantities[i-1])) return 'increasing';
    if (quantities.every((q, i) => i === 0 || q < quantities[i-1])) return 'decreasing';
    return 'stable';
  }

  // Get specific recommendations based on status (3 levels only)
  getStatusRecommendations(item, status, quantity, thresholds) {
    const recommendations = [];
    const optimal = (thresholds.understock + thresholds.overstock) / 2;
    
    switch (status) {
      case 'Understock':
        const urgency = quantity <= (thresholds.understock * 0.5) ? 'critical' : 'high';
        const suggestedQuantity = Math.ceil(optimal - quantity);
        recommendations.push({
          type: 'reorder',
          message: urgency === 'critical' 
            ? `URGENT: Immediate reorder required for ${item.itemName}` 
            : `Reorder ${item.itemName} soon`,
          suggestedQuantity: suggestedQuantity,
          priority: urgency,
          action: 'Purchase additional stock'
        });
        break;
        
      case 'Overstock':
        const excess = quantity - thresholds.overstock;
        recommendations.push({
          type: 'redistribute',
          message: `Consider redistributing excess ${item.itemName}`,
          excessQuantity: excess,
          priority: 'medium',
          action: 'Redistribute or reduce orders'
        });
        break;
        
      case 'Normal':
        recommendations.push({
          type: 'maintain',
          message: `${item.itemName} is at normal stock level`,
          priority: 'low',
          action: 'Continue monitoring'
        });
        break;
    }
    
    return recommendations;
  }

  // Update status for a single item
  updateItemStatus(item) {
    const newStatus = this.calculateStatus(item);
    const hasChanged = item.status !== newStatus;
    
    if (hasChanged) {
      console.log(`📊 Status changed for ${item.itemName}: ${item.status} → ${newStatus}`);
      
      // Create status change event
      const statusChangeEvent = new CustomEvent('statusChanged', {
        detail: {
          item: item,
          oldStatus: item.status,
          newStatus: newStatus,
          quantity: item.quantity,
          thresholds: this.getThresholds(item),
          timestamp: new Date().toISOString()
        }
      });
      
      // Dispatch the event
      window.dispatchEvent(statusChangeEvent);
    }
    
    return {
      ...item,
      status: newStatus,
      statusChanged: hasChanged
    };
  }

  // Update status for multiple items
  updateMultipleItemsStatus(items) {
    const updatedItems = items.map(item => this.updateItemStatus(item));
    const changedItems = updatedItems.filter(item => item.statusChanged);
    
    if (changedItems.length > 0) {
      console.log(`📊 Updated status for ${changedItems.length} items`);
      
      // Create bulk status change event
      const bulkStatusChangeEvent = new CustomEvent('bulkStatusChanged', {
        detail: {
          changedItems: changedItems,
          totalItems: items.length,
          timestamp: new Date().toISOString()
        }
      });
      
      window.dispatchEvent(bulkStatusChangeEvent);
    }
    
    return updatedItems.map(item => {
      const { statusChanged, ...itemWithoutFlag } = item;
      return itemWithoutFlag;
    });
  }

  // Get status statistics
  getStatusStatistics(items) {
    const stats = {
      total: items.length,
      understock: 0,
      normal: 0,
      overstock: 0,
      understockItems: [],
      overstockItems: []
    };

    items.forEach(item => {
      const status = this.calculateStatus(item);
      switch (status) {
        case 'Understock':
          stats.understock++;
          stats.understockItems.push(item);
          break;
        case 'Overstock':
          stats.overstock++;
          stats.overstockItems.push(item);
          break;
        default:
          stats.normal++;
      }
    });

    return stats;
  }

  // Get items that need attention (understock or overstock)
  getItemsNeedingAttention(items) {
    return items.filter(item => {
      const status = this.calculateStatus(item);
      return status === 'Understock' || status === 'Overstock';
    }).map(item => ({
      ...item,
      calculatedStatus: this.calculateStatus(item),
      thresholds: this.getThresholds(item),
      urgency: this.calculateUrgency(item)
    }));
  }

  // Calculate urgency level for items needing attention
  calculateUrgency(item) {
    const quantity = parseInt(item.quantity) || 0;
    const thresholds = this.getThresholds(item);
    
    if (quantity <= thresholds.understock) {
      // More urgent if quantity is much lower than threshold
      const ratio = quantity / thresholds.understock;
      if (ratio <= 0.2) return 'critical';
      if (ratio <= 0.5) return 'high';
      return 'medium';
    }
    
    if (quantity >= thresholds.overstock) {
      // More urgent if quantity is much higher than threshold
      const ratio = quantity / thresholds.overstock;
      if (ratio >= 3) return 'critical';
      if (ratio >= 2) return 'high';
      return 'medium';
    }
    
    return 'low';
  }

  // Generate recommendations based on status
  generateRecommendations(items) {
    const recommendations = [];
    const stats = this.getStatusStatistics(items);
    
    // Understock recommendations
    stats.understockItems.forEach(item => {
      const thresholds = this.getThresholds(item);
      const recommendedOrder = Math.max(
        thresholds.overstock - item.quantity,
        thresholds.understock * 2
      );
      
      recommendations.push({
        type: 'reorder',
        priority: this.calculateUrgency(item),
        item: item,
        message: `Reorder ${item.itemName} - Current: ${item.quantity}, Recommended order: ${recommendedOrder}`,
        suggestedQuantity: recommendedOrder,
        reason: 'Below minimum stock level'
      });
    });
    
    // Overstock recommendations
    stats.overstockItems.forEach(item => {
      const thresholds = this.getThresholds(item);
      const excessQuantity = item.quantity - thresholds.overstock;
      
      recommendations.push({
        type: 'reduce',
        priority: this.calculateUrgency(item),
        item: item,
        message: `Consider redistributing ${item.itemName} - Current: ${item.quantity}, Excess: ${excessQuantity}`,
        excessQuantity: excessQuantity,
        reason: 'Above maximum stock level'
      });
    });
    
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  // Create threshold configuration UI data
  getThresholdConfigData() {
    return {
      defaultThresholds: this.defaultThresholds,
      categoryThresholds: this.categoryThresholds,
      itemThresholds: Object.fromEntries(this.itemThresholds)
    };
  }

  // Validate threshold values
  validateThresholds(thresholds) {
    const errors = [];
    
    if (!thresholds.understock || thresholds.understock < 0) {
      errors.push('Understock threshold must be a positive number');
    }
    
    if (!thresholds.overstock || thresholds.overstock < 0) {
      errors.push('Overstock threshold must be a positive number');
    }
    
    if (thresholds.understock >= thresholds.overstock) {
      errors.push('Understock threshold must be less than overstock threshold');
    }
    
    return errors;
  }

  // Reset thresholds to defaults
  resetThresholds() {
    this.categoryThresholds = {
      'Office Supply': { understock: 5, overstock: 50 },
      'Sanitary Supply': { understock: 15, overstock: 200 },
      'Construction Supply': { understock: 20, overstock: 500 },
      'Electrical Supply': { understock: 8, overstock: 80 }
    };
    this.itemThresholds.clear();
    this.saveThresholds();
  }
}

// Create singleton instance
const supplyThresholdManager = new SupplyThresholdManager();

<<<<<<< HEAD
export default supplyThresholdManager;
=======
export default supplyThresholdManager;
>>>>>>> 2ab8c5ff9b976edf9b794ded8d5bbf899017a469
