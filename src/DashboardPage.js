import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import SuppliesAPI from './suppliesApi';
import EquipmentAPI from './EquipmentApi';
import './DashboardPage.css';

function DashboardPage() {
  const [suppliesData, setSuppliesData] = useState([]);
  const [equipmentData, setEquipmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get actual understock supplies from API data - only those with "Understock" status
  const getUnderstockData = () => {
    return suppliesData.filter(supply => {
      const status = supply.status || '';
      // Only show items with exact "Understock" status
      return status.toLowerCase() === 'understock';
    }).slice(0, 10); // Limit to 10 items for display
  };

  // Get actual equipment beyond useful life from API data - only those with "Beyond-Useful-Life" status
  const getEquipmentBeyondLifeData = () => {
    return equipmentData.filter(equipment => {
      const status = equipment.status || '';
      // Only show items with exact "Beyond-Useful-Life" status
      return status.toLowerCase() === 'beyond-useful-life' ||
             status.toLowerCase() === 'beyond useful life';
    }).slice(0, 10); // Limit to 10 items for display
  };

  const understockData = getUnderstockData();
  const equipmentLifeData = getEquipmentBeyondLifeData();

  // Colors for pie charts
  const supplyColors = ['#4CAF50', '#f44336', '#FF9800']; // Green, Orange, Red
  const equipmentColors = ['#4CAF50', '#FF9800', '#f44336']; // Blue, Orange, Purple  

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Check if user is authenticated first
        if (!SuppliesAPI.isAuthenticated() || !EquipmentAPI.isAuthenticated()) {
          console.warn('User not authenticated, using empty data for charts');
          setSuppliesData([]);
          setEquipmentData([]);
          setLoading(false);
          return;
        }
        
        // Fetch supplies and equipment data in parallel
        const [supplies, equipment] = await Promise.all([
          SuppliesAPI.getAllSupplies().catch(err => {
            console.warn('Failed to fetch supplies:', err);
            if (err.message.includes('Authentication failed')) {
              setError('Please log in to view dashboard data');
            }
            return [];
          }),
          EquipmentAPI.getAllEquipment().catch(err => {
            console.warn('Failed to fetch equipment:', err);
            if (err.message.includes('Authentication failed')) {
              setError('Please log in to view dashboard data');
            }
            return [];
          })
        ]);

        setSuppliesData(supplies || []);
        setEquipmentData(equipment || []);
        
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
  }, []);

  // Process supplies data for pie chart
  const getSupplyStatusData = () => {
    if (!suppliesData.length) {
      // Return sample data when no real data is available
      return [
        { name: 'Normal', value: 15, color: supplyColors[0] },
        { name: 'Understock', value: 5, color: supplyColors[1] },
        { name: 'Overstock', value: 3, color: supplyColors[2] }
      ];
    }

    const statusCounts = suppliesData.reduce((acc, supply) => {
      const status = supply.status || 'Normal';
      
      // Map your actual status values to the three categories
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
    ];
  };

  // Process equipment data for pie chart
  const getEquipmentStatusData = () => {
    if (!equipmentData.length) {
      // Return sample data when no real data is available
      return [
        { name: 'Within-Useful-Life', value: 12, color: equipmentColors[0] },
        { name: 'Maintenance', value: 4, color: equipmentColors[1] },
        { name: 'Beyond-Useful-Life', value: 2, color: equipmentColors[2] }
      ];
    }

    const statusCounts = equipmentData.reduce((acc, equipment) => {
      const status = equipment.status || 'Within-Useful-Life';
      
      // Map your actual status values to the three categories
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
    ];
  };

  // Custom label function for pie charts
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    if (percent === 0) return null;
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: '#333',
          padding: '10px',
          border: '1px solid #555',
          borderRadius: '5px',
          color: 'white'
        }}>
          <p>{`${payload[0].name}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  const supplyChartData = getSupplyStatusData();
  const equipmentChartData = getEquipmentStatusData();

  return (
    <section className="dashboard-content-area">
      <div className="dashboard-grid">
        {/* Top Row: Line Graphs */}
        <div className="graph-card line-graph-1">
          <h3>Supply Consumption Trend</h3>
          <div className="graph-placeholder">Line Graph 1 Data</div>
        </div>
        <div className="graph-card line-graph-2">
          <h3>Equipment Maintenance Costs</h3>
          <div className="graph-placeholder">Line Graph 2 Data</div>
        </div>

        {/* Middle Row: Pie Graphs */}
        <div className="graph-card pie-graph-1">
          <h3>Supply Category Distribution</h3>
          <div style={{ width: '100%', height: '200px' }}>
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
                    label={renderCustomizedLabel}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {supplyChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ color: '#fff', fontSize: '12px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        
        <div className="graph-card pie-graph-2">
          <h3>Equipment Status Breakdown</h3>
          <div style={{ width: '100%', height: '200px' }}>
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
                    label={renderCustomizedLabel}
                    outerRadius={60}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {equipmentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    wrapperStyle={{ color: '#fff', fontSize: '12px' }}
                    iconType="circle"
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottom Row: Tables - Now in a new flex container */}
        <div className="dashboard-tables-row">
          <div className="table-card understock-table">
            <h3>Items Understock!</h3>
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
                {understockData.length > 0 ? (
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
                )}
              </tbody>
            </table>
            <button className="generate-button">Generate Requisition Form</button>
          </div>

          <div className="table-card equipment-life-table">
            <h3>Equipment Beyond Useful Life!</h3>
            <table>
              <thead>
                <tr>
                  <th>Equipment ID</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Last Maintained</th>
                </tr>
              </thead>
              <tbody>
                {equipmentLifeData.length > 0 ? (
                  equipmentLifeData.map((item, index) => (
                    <tr key={index}>
                      <td>{item.itemCode || item.id || 'N/A'}</td>
                      <td>{item.name || 'N/A'}</td>
                      <td>{item.category || item.department || 'N/A'}</td>
                      <td>{item.lastMaintained || item.date || 'N/A'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{textAlign: 'center', color: '#888'}}>
                      {loading ? 'Loading...' : 'No equipment beyond useful life found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <button className="generate-button">Generate Repair Form</button>
          </div>
        </div>

      </div>
    </section>
  );
}

export default DashboardPage;