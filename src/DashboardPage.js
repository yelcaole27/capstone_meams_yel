import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import SuppliesAPI from './suppliesApi';
import EquipmentAPI from './EquipmentApi';
import './DashboardPage.css';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import DynamicRequisitionForm from './DynamicRequisitionForm';
import DynamicPurchaseForm from './DynamicPurchaseForm';
import DynamicRepairForm from './DynamicRepairForm';
import supplyThresholdManager from './SupplyThresholdManager';

function DashboardPage() {
  const { authToken, isAuthenticated, loading: authLoading } = useAuth();
  const { getChartColors } = useTheme();
  const chartColors = getChartColors();
  const [suppliesData, setSuppliesData] = useState([]);
  const [equipmentData, setEquipmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSupplyIndex, setActiveSupplyIndex] = useState(null);
  const [activeEquipmentIndex, setActiveEquipmentIndex] = useState(null);
  const [suppliesForecastData, setSuppliesForecastData] = useState([]);
  const [equipmentForecastData, setEquipmentForecastData] = useState([]);

  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showOfficeSupplyForm, setShowOfficeSupplyForm] = useState(false);
  const [showOtherSupplyForm, setShowOtherSupplyForm] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [showRepairForm, setShowRepairForm] = useState(false);
  const { theme } = useTheme()


  const pluralizeUnit = (unit, quantity) => {
  const qty = parseInt(quantity) || 0;
  
  if (qty <= 1) return unit;
  
  const lowerUnit = unit.toLowerCase();
  
  const plurals = {
    'piece': 'pieces',
    'pack': 'packs',
    'box': 'boxes',
    'bottle': 'bottles',
    'gallon': 'gallons',
    'set': 'sets',
    'roll': 'rolls',
    'bag': 'bags',
    'meter': 'meters',
    'ream': 'reams'
  };
  
  return plurals[lowerUnit] || unit;
};

 const getUnderstockData = () => {
  const itemsWithCorrectStatus = suppliesData.map(supply => {
    const tempItem = {
      itemName: supply.itemName || supply.name,
      category: supply.category,
      quantity: supply.quantity
    };
    
    const calculatedStatus = supplyThresholdManager.calculateStatus(tempItem);
    
    return {
      ...supply,
      status: calculatedStatus
    };
  });
  
  const understockItems = itemsWithCorrectStatus.filter(item => {
    const status = (item.status || '').toLowerCase().trim();
    return status === 'understock';
  });
  
  // ✅ NEW: Sort by date (newest first) or _id
  return understockItems.sort((a, b) => {
    // Try sorting by date first
    if (a.date && b.date) {
      return new Date(b.date) - new Date(a.date);
    }
    // Fall back to _id sorting (MongoDB IDs are chronological)
    if (a._id && b._id) {
      return b._id.toString().localeCompare(a._id.toString());
    }
    return 0;
  });
};

  const getEquipmentBeyondLifeData = () => {
  const replacementEquipment = equipmentData.filter(equipment => {
    const repairHistory = equipment.repairHistory || [];
    const usefulLife = equipment.usefulLife || 5;
    const purchasePrice = equipment.amount || 0;
    const currentDate = new Date();
    const purchaseDate = equipment.date ? new Date(equipment.date) : currentDate;
    const ageInYears = (currentDate - purchaseDate) / (1000 * 60 * 60 * 24 * 365);

    const totalRepairs = repairHistory.length;
    const totalRepairCost = repairHistory.reduce((sum, repair) => sum + (parseFloat(repair.amountUsed) || 0), 0);
    const repairFrequency = ageInYears > 0 ? totalRepairs / ageInYears : 0;
    const costThreshold = purchasePrice * 0.5;

    let recommendReplacement = false;

    if (totalRepairCost >= costThreshold) recommendReplacement = true;
    if (repairFrequency > 3) recommendReplacement = true;
    if (ageInYears >= usefulLife) recommendReplacement = true;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentRepairs = repairHistory.filter(repair => {
      const repairDate = new Date(repair.repairDate);
      return repairDate >= sixMonthsAgo;
    }).length;

    if (recentRepairs >= 3) recommendReplacement = true;

    return recommendReplacement;
  });
  
  // ✅ Sort by age (oldest equipment first = most critical)
  return replacementEquipment.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date();
    const dateB = b.date ? new Date(b.date) : new Date();
    return dateA - dateB; // Oldest first
  });
};

  const getEquipmentMaintenanceData = () => {
  const maintenanceEquipment = equipmentData.filter(equipment => {
    return equipment.reportDate || 
           equipment.status?.toLowerCase().includes('maintenance') || 
           equipment.status?.toLowerCase().includes('repair') ||
           equipment.status?.toLowerCase().includes('service');
  });
  
  // ✅ Sort by report date (most recent first)
  return maintenanceEquipment.sort((a, b) => {
    const dateA = a.reportDate ? new Date(a.reportDate) : new Date(0);
    const dateB = b.reportDate ? new Date(b.reportDate) : new Date(0);
    return dateB - dateA; // Newest first
  });
};

  const getEquipmentPurchaseData = () => {
  const purchaseEquipment = equipmentData.filter(equipment => {
    const repairHistory = equipment.repairHistory || [];
    const usefulLife = equipment.usefulLife || 5;
    const purchasePrice = equipment.amount || 0;
    const currentDate = new Date();
    const purchaseDate = equipment.date ? new Date(equipment.date) : currentDate;
    const ageInYears = (currentDate - purchaseDate) / (1000 * 60 * 60 * 24 * 365);

    const totalRepairs = repairHistory.length;
    const totalRepairCost = repairHistory.reduce((sum, repair) => sum + (parseFloat(repair.amountUsed) || 0), 0);
    const repairFrequency = ageInYears > 0 ? totalRepairs / ageInYears : 0;
    const costThreshold = purchasePrice * 0.5;

    let recommendReplacement = false;

    if (totalRepairCost >= costThreshold) recommendReplacement = true;
    if (repairFrequency > 3) recommendReplacement = true;
    if (ageInYears >= usefulLife) recommendReplacement = true;

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const recentRepairs = repairHistory.filter(repair => {
      const repairDate = new Date(repair.repairDate);
      return repairDate >= sixMonthsAgo;
    }).length;

    if (recentRepairs >= 3) recommendReplacement = true;

    return recommendReplacement;
  });
  
  // ✅ Sort by age (oldest equipment first = most critical to replace)
  return purchaseEquipment.sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date();
    const dateB = b.date ? new Date(b.date) : new Date();
    return dateA - dateB; // Oldest first
  });
};
  const understockData = getUnderstockData();
  const equipmentLifeData = getEquipmentBeyondLifeData();

 const supplyColors = ['#4CAF50', '#F44336', '#FF9800'];
const equipmentColors = ['#2196F3', '#9C27B0', '#FF5722'];

  useEffect(() => {
  const fetchData = async () => {
    if (authLoading) return;

    try {
      setLoading(true);

      if (!isAuthenticated) {
        console.warn('User not authenticated, using empty data for charts');
        setSuppliesData([]);
        setEquipmentData([]);
        setSuppliesForecastData([]);
        setEquipmentForecastData([]);
        setLoading(false);
        return;
      }

      const [supplies, equipment] = await Promise.all([
        SuppliesAPI.getAllSupplies(authToken).catch(err => {
          console.warn('Failed to fetch supplies:', err);
          if (err.message.includes('Authentication failed')) {
            setError('Please log in to view dashboard data');
          }
          return [];
        }),
        EquipmentAPI.getAllEquipment(authToken).catch(err => {
          console.warn('Failed to fetch equipment:', err);
          if (err.message.includes('Authentication failed')) {
            setError('Please log in to view dashboard data');
          }
          return [];
        })
      ]);

      // ✅ Transform supplies data like in SuppliesPage
      const transformedSupplies = supplies.map(supply => {
  let itemCode = supply.itemCode;
  if (!itemCode) {
    const categoryPrefix = supply.category ? supply.category.substring(0, 3).toUpperCase() : 'SUP';
    const randomNum = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    itemCode = `${categoryPrefix}-${randomNum}`;
  }

  return {
    _id: supply._id,
    itemCode: itemCode,
    stockNo: supply.supplier || Math.floor(Math.random() * 100).toString(),
    quantity: supply.quantity,
    itemName: supply.name,
    name: supply.name,
    category: supply.category,
    description: supply.description || '',
    unit: supply.unit || 'piece',
    location: supply.location || '',
    status: supply.status || 'Normal', // This will be recalculated below
    date: supply.date || '',
    has_image: supply.image_data ? true : false,
    image_data: supply.image_data || null,
    transactionHistory: supply.transactionHistory || []
  };
});

      const suppliesWithUpdatedStatus = supplyThresholdManager.updateMultipleItemsStatus(transformedSupplies);

setSuppliesData(suppliesWithUpdatedStatus); // Set state ONCE with corrected status
setEquipmentData(equipment || []);
      // Fetch forecast data
      const [suppliesForecastRes, equipmentForecastRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/api/forecast-supplies`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }).then(res => res.json()),
        fetch(`${process.env.REACT_APP_API_URL}/api/forecast-equipment`, {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        }).then(res => res.json())
      ]);

      if (suppliesForecastRes.success) {
        const enrichedSuppliesData = suppliesForecastRes.data.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          lower_bound: parseFloat(item.lower_bound) || 0,
          upper_bound: parseFloat(item.upper_bound) || 0,
          forecast_type: item.forecast_type || 'historical'
        }));
        setSuppliesForecastData(enrichedSuppliesData);
        console.log('Supplies forecast loaded:', enrichedSuppliesData.length, 'months');
      } else {
        console.error('Failed to fetch supplies forecast:', suppliesForecastRes.message);
        setSuppliesForecastData([]);
      }

      if (equipmentForecastRes.success) {
        const enrichedEquipmentData = equipmentForecastRes.data.map(item => ({
          ...item,
          quantity: parseFloat(item.quantity) || 0,
          lower_bound: parseFloat(item.lower_bound) || 0,
          upper_bound: parseFloat(item.upper_bound) || 0,
          forecast_type: item.forecast_type || 'historical'
        }));
        setEquipmentForecastData(enrichedEquipmentData);
        console.log('Equipment forecast loaded:', enrichedEquipmentData.length, 'months');
      } else {
        console.error('Failed to fetch equipment forecast:', equipmentForecastRes.message);
        setEquipmentForecastData([]);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      if (err.message.includes('Authentication failed')) {
        setError('Please log in to view dashboard data');
      } else {
        setError('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [authToken, isAuthenticated, authLoading]);

  const handleGenerateRequisition = () => {
    setShowRequisitionModal(true);
  };

  const handleGenerateRepair = () => {
    setShowRepairModal(true);
  };

  const handleRequisitionChoice = (choice) => {
    console.log(`Selected requisition type: ${choice}`);
    setShowRequisitionModal(false);

    if (choice === 'OFFICE SUPPLIES') {
      setShowOfficeSupplyForm(true);
      setShowOtherSupplyForm(false);
    } else if (choice === 'OTHER SUPPLIES') {
      setShowOfficeSupplyForm(false);
      setShowOtherSupplyForm(true);
    }
  };

  const getOtherRequisitionData = () => {
  const otherSupplyCategories = ['construction supply', 'sanitary supply', 'electrical supply'];
  const otherUnderstockItems = understockData.filter(item => {
    const category = (item.category || '').toLowerCase();
    return otherSupplyCategories.some(cat => category.includes(cat));
  });

  return otherUnderstockItems.map(item => {
    const qty = item.quantity || item.currentStock || 0;
    const baseUnit = item.unit || item.unitType || 'piece';
    return {
      qty: qty,
      unit: pluralizeUnit(baseUnit, qty),
      description: item.name || item.itemName || 'N/A',
      remarks: ''
    };
  });
};

  const getRequisitionData = () => {
  const officeSupplyCategories = ['office supply'];
  const officeUnderstockItems = understockData.filter(item => {
    const category = (item.category || '').toLowerCase();
    return officeSupplyCategories.some(cat => category.includes(cat));
  });

  return officeUnderstockItems.map(item => {
    const qty = item.quantity || item.currentStock || 0;
    const baseUnit = item.unit || item.unitType || 'piece';
    return {
      qty: qty,
      unit: pluralizeUnit(baseUnit, qty),
      description: item.name || item.itemName || 'N/A',
      remarks: ''
    };
  });
};

  const handleRepairChoice = (choice) => {
    console.log(`Selected repair type: ${choice}`);
    setShowRepairModal(false);
    
    if (choice === 'PURCHASE') {
      setShowPurchaseForm(true);
    } else if (choice === 'REPAIR REQUEST') {
      setShowRepairForm(true);
    }
  };

  const getPurchaseFormData = () => {
    const purchaseItems = getEquipmentPurchaseData();
    
    return purchaseItems.map(item => ({
      itemCode: item.itemCode || item.id || 'N/A',
      unit: item.unit || 'pcs',
      equipmentName: item.name || 'N/A',
      description: item.description || item.category || 'N/A',
      quantity: 1,
      amount: '',
      remarks: 'REPLACE'
    }));
  };

  const getRepairFormData = () => {
    const repairItems = getEquipmentMaintenanceData();
    
    return repairItems.map(item => ({
      itemCode: item.itemCode || item.id || 'N/A',
      equipmentName: item.name || 'N/A',
      reportDetails: item.reportDetails || 'N/A',
      amount: ''
    }));
  };

  const closeModal = () => {
    setShowRequisitionModal(false);
    setShowRepairModal(false);
    setShowOfficeSupplyForm(false);
    setShowOtherSupplyForm(false);
    setShowPurchaseForm(false);
    setShowRepairForm(false);
  };

  const getSupplyStatusData = () => {
    if (!suppliesData.length) {
      return [
        {name: 'Normal', value: 15, color: supplyColors[0] },
        { name: 'Understock', value: 5, color: supplyColors[1] },
        { name: 'Overstock', value: 3, color: supplyColors[2] }
      ];
    }

    const statusCounts = suppliesData.reduce((acc, supply) => {
      const status = supply.status || 'Normal';

      if (status.toLowerCase().includes('understock') || status.toLowerCase().includes('low')) {
        acc.Understock += 1;
      } else if (status.toLowerCase().includes('overstock') || status.toLowerCase().includes('excess')) {
        acc.Overstock += 1;
      } else {
        acc.Normal += 1;
      }

      return acc;
    }, { Normal: 0, Understock: 0, Overstock: 0 });

    return [
      { name: 'Normal', value: statusCounts.Normal, color: supplyColors[0] },
      { name: 'Understock', value: statusCounts.Understock, color: supplyColors[1] },
      { name: 'Overstock', value: statusCounts.Overstock, color: supplyColors[2] }
    ].filter(item => item.value > 0);
  };

  const getEquipmentStatusData = () => {
    if (!equipmentData.length) {
      return [
        { name: 'Within-Useful-Life', value: 12, color: equipmentColors[0] },
        { name: 'Maintenance', value: 4, color: equipmentColors[1] },
        { name: 'Beyond-Useful-Life', value: 2, color: equipmentColors[2] }
      ];
    }

    const statusCounts = equipmentData.reduce((acc, equipment) => {
      const status = equipment.status || 'Within-Useful-Life';

      if (status.toLowerCase().includes('maintenance') || status.toLowerCase().includes('repair')) {
        acc.Maintenance += 1;
      } else if (status.toLowerCase().includes('beyond') || status.toLowerCase().includes('end') ||
                 status.toLowerCase().includes('obsolete') || status.toLowerCase().includes('retired')) {
        acc['Beyond-Useful-Life'] += 1;
      } else {
        acc['Within-Useful-Life'] += 1;
      }

      return acc;
    }, { 'Within-Useful-Life': 0, 'Maintenance': 0, 'Beyond-Useful-Life': 0 });

    return [
      { name: 'Within-Useful-Life', value: statusCounts['Within-Useful-Life'], color: equipmentColors[0] },
      { name: 'Maintenance', value: statusCounts.Maintenance, color: equipmentColors[1] },
      { name: 'Beyond-Useful-Life', value: statusCounts['Beyond-Useful-Life'], color: equipmentColors[2] }
    ].filter(item => item.value > 0);
  };

  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }, chartData) => {
  if (percent < 0.05) return null;

  const RADIAN = Math.PI / 180;
  const radius = (innerRadius + outerRadius) / 2;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Calculate adjusted percentage to match table
  const total = chartData.reduce((sum, item) => sum + item.value, 0);
  const percentages = chartData.map(item => Math.round((item.value / total) * 100));
  const percentageSum = percentages.reduce((sum, p) => sum + p, 0);
  
  if (percentageSum !== 100 && percentages.length > 0) {
    const diff = 100 - percentageSum;
    const maxIndex = percentages.indexOf(Math.max(...percentages));
    percentages[maxIndex] += diff;
  }

  return (
    <text
      x={x}
      y={y}
      fill="#ffffff"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize="12"
      fontWeight="600"
    >
      {`${percentages[index]}%`}
    </text>
  );
};

  const renderTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={{
          backgroundColor: chartColors.tooltipBg,
          padding: '10px',
          border: `1px solid ${chartColors.tooltipBorder}`,
          borderRadius: '4px',
          color: chartColors.tooltipText,
          fontSize: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontWeight: 'bold' }}>{data.name}</div>
          <div>Count: {data.value}</div>
        </div>
      );
    }
    return null;
  };

  const renderLineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: chartColors.tooltipBg,
          padding: '10px',
          border: `1px solid ${chartColors.tooltipBorder}`,
          borderRadius: '4px',
          color: chartColors.tooltipText,
          fontSize: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <p className="label" style={{ color: chartColors.tooltipText }}>{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color, margin: '4px 0' }}>
              {`${entry.name}: ${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const onPieEnter = (data, index, setActiveIndex) => {
    setActiveIndex(index);
  };

  const onPieLeave = (setActiveIndex) => {
    setActiveIndex(null);
  };

  const supplyChartData = getSupplyStatusData();
  const equipmentChartData = getEquipmentStatusData();

  return (
    <section className="dashboard-content-area">
      <div className="dashboard-grid">
{/* Extended Line Graphs: Supplies + Equipment */}
<div className="graph-row-extended">
  <div className="graph-card line-graph-1" >
    <h3>Supplies Trend & Forecast (2024–2025)</h3>
    <div style={{ width: '100%', height: '400px' }}>
      {loading ? (
        <div className="graph-placeholder">Loading supplies forecast...</div>
      ) : error ? (
        <div className="graph-placeholder">Error loading data</div>
      ) : suppliesForecastData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%" >
          <LineChart
            data={suppliesForecastData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="date"
              stroke={chartColors.axis}
              tick={{ fill: chartColors.text }}
              tickFormatter={(tick) =>
                new Date(tick).toLocaleDateString('en-US', {
                  month: 'short',
                  year: '2-digit',
                })
              }
            />
            <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.text }} />
            <Tooltip content={renderLineTooltip} />
            <Legend />
            <Line
              type="monotone"
              dataKey="quantity"
              stroke={chartColors.primaryLine || '#2e7d32'}
              strokeWidth={2.5}
              activeDot={{ r: 7 }}
              name="Quantity"
            />
            <Line
              type="monotone"
              dataKey="lower_bound"
              stroke={chartColors.secondaryLine || '#1565c0'}
              strokeDasharray="5 5"
              strokeWidth={2}
              name="Lower Bound"

              dot={false}
            />
            <Line
              type="monotone"
              dataKey="upper_bound"
              stroke={chartColors.accentLine || '#ef6c00'}
              strokeDasharray="5 5"
              strokeWidth={2}
              name="Upper Bound"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="graph-placeholder">No supplies forecast data available.</div>
      )}
    </div>
  </div>

  <div className="graph-card line-graph-2">
    <h3>Equipment Trend & Forecast (2024–2025)</h3>
    <div style={{ width: '100%', height: '400px' }}>
      {loading ? (
        <div className="graph-placeholder">Loading equipment forecast...</div>
      ) : error ? (
        <div className="graph-placeholder">Error loading data</div>
      ) : equipmentForecastData.length > 0 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={equipmentForecastData}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
            <XAxis
              dataKey="date"
              stroke={chartColors.axis}
              tick={{ fill: chartColors.text }}
              tickFormatter={(tick) =>
                new Date(tick).toLocaleDateString('en-US', {
                  month: 'short',
                  year: '2-digit',
                })
              }
            />
            <YAxis stroke={chartColors.axis} tick={{ fill: chartColors.text }} />
            <Tooltip content={renderLineTooltip} />
            <Legend />
            <Line
              type="monotone"
              dataKey="quantity"
              stroke={chartColors.primaryLine || '#2e7d32'}
              strokeWidth={2.5}
              activeDot={{ r: 7 }}
              name="Quantity"
            />
            <Line
              type="monotone"
              dataKey="lower_bound"
              stroke={chartColors.secondaryLine || '#1565c0'}
              strokeDasharray="5 5"
              strokeWidth={2}
              name="Lower Bound"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="upper_bound"
              stroke={chartColors.accentLine || '#ef6c00'}
              strokeDasharray="5 5"
              strokeWidth={2}
              name="Upper Bound"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="graph-placeholder">No equipment forecast data available.</div>
      )}
    </div>
  </div>
</div>


        {/* Middle Row: Pie Charts with Status Tables */}
        <div className="graph-card pie-graph-1">
          <h3>Supply Status Distribution</h3>
          <div style={{ display: 'flex', gap: '20px', height: '280px' }}>
            <div style={{ flex: '1', minWidth: '300px' }}>
              {loading ? (
                <div className="graph-placeholder">Loading supply data...</div>
              ) : error ? (
                <div className="graph-placeholder">Error loading data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
  data={supplyChartData}
  cx="50%"
  cy="50%"
  labelLine={false}
  label={(props) => renderLabel(props, supplyChartData)}
  outerRadius={80}
  innerRadius={0}
  fill="#8884d8"
  dataKey="value"
  onMouseEnter={(data, index) => onPieEnter(data, index, setActiveSupplyIndex)}
  onMouseLeave={() => onPieLeave(setActiveSupplyIndex)}
>
                      {supplyChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke={activeSupplyIndex === index ? '#fff' : 'none'}
                          strokeWidth={activeSupplyIndex === index ? 2 : 0}
                          style={{
                            filter: activeSupplyIndex === index ? 'brightness(1.1)' : 'none',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={renderTooltip} />
                    <Legend 
  formatter={(value) => <span style={{ color: chartColors.text }}>{value}</span>}
  iconSize={25}
  wrapperStyle={{ fontSize: '14px' }}
/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            <div style={{ flex: '0 0 250px' }}>
              <div className="status-table-container">
                <h4 style={{
                    margin: '0 0 15px 0',
                    color: chartColors.text,
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                   Supply Status Summary
                </h4>
                <table className="status-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>%</th>
                    </tr>
                  </thead>
<tbody>
  {(() => {
    const data = getSupplyStatusData();
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    // Calculate rounded percentages
    const percentages = data.map(item => Math.round((item.value / total) * 100));
    const percentageSum = percentages.reduce((sum, p) => sum + p, 0);
    
    // Adjust the largest item to make total = 100%
    if (percentageSum !== 100 && percentages.length > 0) {
      const diff = 100 - percentageSum;
      const maxIndex = percentages.indexOf(Math.max(...percentages));
      percentages[maxIndex] += diff;
    }
    
    return data.map((item, index) => (
      <tr key={index}>
        <td style={{ color: item.color, fontWeight: 'bold' }}>
          {item.name}
        </td>
        <td>{item.value}</td>
        <td>{percentages[index]}%</td>
      </tr>
    ));
  })()}
  <tr className="total-row">
    <td><strong>Total</strong></td>
    <td><strong>{getSupplyStatusData().reduce((sum, item) => sum + item.value, 0)}</strong></td>
    <td><strong>100%</strong></td>
  </tr>
</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="graph-card pie-graph-2">
          <h3>Equipment Status Distribution</h3>
          <div style={{ display: 'flex', gap: '20px', height: '280px' }}>
            <div style={{ flex: '1', minWidth: '300px' }}>
              {loading ? (
                <div className="graph-placeholder">Loading equipment data...</div>
              ) : error ? (
                <div className="graph-placeholder">Error loading data</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
  data={equipmentChartData}
  cx="50%"
  cy="50%"
  labelLine={false}
  label={(props) => renderLabel(props, equipmentChartData)}
  outerRadius={80}
  innerRadius={0}
  fill="#8884d8"
  dataKey="value"
  onMouseEnter={(data, index) => onPieEnter(data, index, setActiveEquipmentIndex)}
  onMouseLeave={() => onPieLeave(setActiveEquipmentIndex)}
>
                      {equipmentChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke={activeEquipmentIndex === index ? '#fff' : 'none'}
                          strokeWidth={activeEquipmentIndex === index ? 2 : 0}
                          style={{
                            filter: activeEquipmentIndex === index ? 'brightness(1.1)' : 'none',
                            cursor: 'pointer'
                          }}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={renderTooltip} />
                    <Legend 
  formatter={(value) => <span style={{ color: chartColors.text }}>{value}</span>}
  iconSize={25}
  wrapperStyle={{ fontSize: '14px' }}
/>
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            <div style={{ flex: '0 0 250px' }}>
              <div className="status-table-container">
                <h4 style={{
                    margin: '0 0 15px 0',
                    color: chartColors.text,
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}>
                  Equipment Status Summary
                </h4>
                <table className="status-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
  {(() => {
    const data = getEquipmentStatusData();
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    // Calculate rounded percentages
    const percentages = data.map(item => Math.round((item.value / total) * 100));
    const percentageSum = percentages.reduce((sum, p) => sum + p, 0);
    
    // Adjust the largest item to make total = 100%
    if (percentageSum !== 100 && percentages.length > 0) {
      const diff = 100 - percentageSum;
      const maxIndex = percentages.indexOf(Math.max(...percentages));
      percentages[maxIndex] += diff;
    }
    
    return data.map((item, index) => (
      <tr key={index}>
        <td style={{ color: item.color, fontWeight: 'bold' }}>
          {item.name}
        </td>
        <td>{item.value}</td>
        <td>{percentages[index]}%</td>
      </tr>
    ));
  })()}
  <tr className="total-row">
    <td><strong>Total</strong></td>
    <td><strong>{getEquipmentStatusData().reduce((sum, item) => sum + item.value, 0)}</strong></td>
    <td><strong>100%</strong></td>
  </tr>
</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Row: Tables */}
        <div className="dashboard-tables-row">
          <div className="table-card understock-table">
            <h3>Understock Items!</h3>
            <table>
              <thead>
                <tr>
                  <th>Item Code</th>
                  <th>Stock No.</th>
                  <th>Item Name</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
  {(() => {
    const understockData = getUnderstockData();
    console.log('🔍 Rendering understock table with', understockData.length, 'items');
    
    return understockData.length > 0 ? (
      understockData.map((item, index) => (
        <tr key={index}>
          <td>{item.itemCode || item.id || 'N/A'}</td>
          <td>{item.quantity || item.stockNo || 0}</td>
          <td>{item.name || item.itemName || 'N/A'}</td>
          <td>{item.category || 'N/A'}</td>
        </tr>
      ))
    ) : (
      <tr>
        <td colSpan="4" style={{textAlign: 'center', color: '#888'}}>
          {loading ? 'Loading...' : 'No understock items found'}
        </td>
      </tr>
    );
  })()}
</tbody>
            </table>
            <button
              className="generate-button"
              onClick={handleGenerateRequisition}
              style={{ cursor: 'pointer' }}
            >
              Generate Requisition Form
            </button>
          </div>

          {/* New Equipment Maintenance Table */}
          <div className="table-card equipment-maintenance-table" style={{ margin: '0 20px' }}>
  <h3>Equipment Maintenance</h3>
  <table>
    <thead>
      <tr>
        <th>Item Code</th>
        <th>Equipment Name</th>
        <th>Report Details</th>
        <th>Report Date</th>
      </tr>
    </thead>
    <tbody>
      {getEquipmentMaintenanceData().length > 0 ? (
        getEquipmentMaintenanceData().map((item, index) => (
          <tr key={index}>
            <td>{item.itemCode || item.id || 'N/A'}</td>
            <td>{item.name || 'N/A'}</td>
            <td>{item.reportDetails || 'N/A'}</td>
            <td>{item.reportDate || 'N/A'}</td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan="4" style={{textAlign: 'center', color: '#888'}}>
            {loading ? 'Loading...' : 'No equipment maintenance records found'}
          </td>
        </tr>
      )}
    </tbody>
  </table>
  <button
    className="generate-button"
    onClick={() => setShowRepairForm(true)}
    style={{ cursor: 'pointer' }}
  >
    Generate Repair Form
  </button>
</div>

          <div className="table-card equipment-life-table">
  <h3>Equipment Due for Replacement!</h3>
  <table>
    <thead>
      <tr>
        <th>Item Code</th>
        <th>Equipment Name</th>
        <th>Category</th>
        <th>Remarks</th>
      </tr>
    </thead>
    <tbody>
      {equipmentLifeData.length > 0 ? (
        equipmentLifeData.map((item, index) => (
          <tr key={index}>
            <td>{item.itemCode || item.id || 'N/A'}</td>
            <td>{item.name || 'N/A'}</td>
            <td>{item.category || 'N/A'}</td>
            <td style={{ color: '#dc3545', fontWeight: 'bold' }}>REPLACE</td>
          </tr>
        ))
      ) : (
        <tr>
          <td colSpan="4" style={{textAlign: 'center', color: '#888'}}>
            {loading ? 'Loading...' : 'No equipment recommended for replacement'}
          </td>
        </tr>
      )}
    </tbody>
  </table>
          <button
            className="generate-button"
            onClick={() => setShowPurchaseForm(true)}
            style={{ cursor: 'pointer' }}
          >
            Generate Purchase Form
          </button>
          </div>
        </div>

      </div>

      {/* Requisition Modal */}
      {showRequisitionModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#f0f0f0',
            padding: '30px',
            borderRadius: '8px',
            textAlign: 'center',
            minWidth: '300px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>
              SELECT REQUISITION FORM TO GENERATE
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => handleRequisitionChoice('OFFICE SUPPLIES')}
                style={{
                  backgroundColor: '#000',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                OFFICE SUPPLIES
              </button>
              <button
                onClick={() => handleRequisitionChoice('OTHER SUPPLIES')}
                style={{
                  backgroundColor: '#000',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                OTHER SUPPLIES
              </button>
            </div>
            <button
              onClick={closeModal}
              style={{
                marginTop: '20px',
                backgroundColor: 'transparent',
                border: '1px solid #ccc',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Repair Modal */}
      {showRepairModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#f0f0f0',
            padding: '30px',
            borderRadius: '8px',
            textAlign: 'center',
            minWidth: '300px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
          }}>
            <h3 style={{ marginBottom: '20px', color: '#333' }}>
              SELECT REPAIR FORM TO GENERATE
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            </div>
            <button
              onClick={closeModal}
              style={{
                marginTop: '20px',
                backgroundColor: 'transparent',
                border: '1px solid #ccc',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Office Supply Requisition Form */}
{showOfficeSupplyForm && (
  <DynamicRequisitionForm
    initialData={getRequisitionData()}
    formType="OFFICE SUPPLIES"
    onClose={closeModal}
  />
)}

{/* Other Supply Requisition Form */}
{showOtherSupplyForm && (
  <DynamicRequisitionForm
    initialData={getOtherRequisitionData()}
    formType="OTHER SUPPLIES"
    onClose={closeModal}
  />
)}

      {/* Purchase Form Modal */}
{showPurchaseForm && (
  <DynamicPurchaseForm
    initialData={getPurchaseFormData()}
    onClose={closeModal}
  />
)}

      {/* Repair Form Modal */}
{showRepairForm && (
  <DynamicRepairForm
    initialData={getRepairFormData()}
    onClose={closeModal}
  />
)}
    </section>
  );
}

export default DashboardPage;
