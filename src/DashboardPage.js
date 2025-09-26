import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, Sector, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'; // NEW: Added LineChart, Line, XAxis, YAxis, CartesianGrid
import SuppliesAPI from './suppliesApi';
import EquipmentAPI from './EquipmentApi';
import './DashboardPage.css';
import { useAuth } from './AuthContext'; // NEW: Import useAuth

function DashboardPage() {
  const { authToken, isAuthenticated, loading: authLoading } = useAuth(); // NEW: Get authToken and auth status
  const [suppliesData, setSuppliesData] = useState([]);
  const [equipmentData, setEquipmentData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSupplyIndex, setActiveSupplyIndex] = useState(null);
  const [activeEquipmentIndex, setActiveEquipmentIndex] = useState(null);

  // NEW STATE FOR FORECAST DATA
  const [suppliesForecastData, setSuppliesForecastData] = useState([]);
  const [equipmentForecastData, setEquipmentForecastData] = useState([]);
  // END NEW STATE

  // New state for modal visibility
  const [showRequisitionModal, setShowRequisitionModal] = useState(false);
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [showOfficeSupplyForm, setShowOfficeSupplyForm] = useState(false);
  const [showOtherSupplyForm, setShowOtherSupplyForm] = useState(false);

  // Get actual understock supplies from API data
  const getUnderstockData = () => {
    return suppliesData.filter(supply => {
      const status = supply.status || '';
      return status.toLowerCase() === 'understock';
    }).slice(0, 10);
  };

  // Get actual equipment beyond useful life from API data
  const getEquipmentBeyondLifeData = () => {
    return equipmentData.filter(equipment => {
      const status = equipment.status || '';
      return status.toLowerCase() === 'beyond-useful-life' ||
             status.toLowerCase() === 'beyond useful life';
    }).slice(0, 10);
  };

  const understockData = getUnderstockData();
  const equipmentLifeData = getEquipmentBeyondLifeData();

  // Clean, professional color palette
  const supplyColors = ['#4CAF50', '#F44336', '#FF9800'];
  const equipmentColors = ['#4CAF50', '#FF9800', '#F44336'];

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      if (authLoading) return; // Wait for auth context to load

      try {
        setLoading(true);

        if (!isAuthenticated) { // Use isAuthenticated from AuthContext
          console.warn('User not authenticated, using empty data for charts');
          setSuppliesData([]);
          setEquipmentData([]);
          setSuppliesForecastData([]); // Clear forecast data too
          setEquipmentForecastData([]); // Clear forecast data too
          setLoading(false);
          return;
        }

        // Fetch main supplies and equipment data
        const [supplies, equipment] = await Promise.all([
          SuppliesAPI.getAllSupplies(authToken).catch(err => { // Pass authToken
            console.warn('Failed to fetch supplies:', err);
            if (err.message.includes('Authentication failed')) {
              setError('Please log in to view dashboard data');
            }
            return [];
          }),
          EquipmentAPI.getAllEquipment(authToken).catch(err => { // Pass authToken
            console.warn('Failed to fetch equipment:', err);
            if (err.message.includes('Authentication failed')) {
              setError('Please log in to view dashboard data');
            }
            return [];
          })
        ]);

        setSuppliesData(supplies || []);
        setEquipmentData(equipment || []);

        // NEW: Fetch forecast data
        const [suppliesForecastRes, equipmentForecastRes] = await Promise.all([
          fetch('http://localhost:8000/api/forecast-supplies', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }).then(res => res.json()),
          fetch('http://localhost:8000/api/forecast-equipment', {
            headers: {
              'Authorization': `Bearer ${authToken}`
            }
          }).then(res => res.json())
        ]);

        if (suppliesForecastRes.success) {
          setSuppliesForecastData(suppliesForecastRes.data);
        } else {
          console.error('Failed to fetch supplies forecast:', suppliesForecastRes.message);
          setSuppliesForecastData([]);
        }

        if (equipmentForecastRes.success) {
          setEquipmentForecastData(equipmentForecastRes.data);
        } else {
          console.error('Failed to fetch equipment forecast:', equipmentForecastRes.message);
          setEquipmentForecastData([]);
        }
        // END NEW: Fetch forecast data

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
  }, [authToken, isAuthenticated, authLoading]); // Re-run when authToken or auth status changes

  // Handle button clicks
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
  const officeSupplyCategories = ['office', 'stationery', 'paper', 'supplies', 'administrative'];

  // Filters understock items to find those NOT in the office supply categories
  const otherUnderstockItems = understockData.filter(item => {
    const category = (item.category || '').toLowerCase();
    return !officeSupplyCategories.some(cat => category.includes(cat));
  });

  // Map the filtered items to the requisition form's data structure
  return otherUnderstockItems.map(item => ({
    qty: calculateRequiredQuantity(item),
    unit: item.unit || 'pcs',
    description: item.name || item.itemName || 'N/A',
    remarks: ''
  }));
};

  // Prepare requisition data from understock items
  const getRequisitionData = () => {
    const officeSupplyCategories = ['office', 'stationery', 'paper', 'supplies', 'administrative'];

    const officeUnderstockItems = understockData.filter(item => {
      const category = (item.category || '').toLowerCase();
      return officeSupplyCategories.some(cat => category.includes(cat));
    });

    return officeUnderstockItems.map(item => ({
      qty: calculateRequiredQuantity(item),
      unit: item.unit || 'pcs',
      description: item.name || item.itemName || 'N/A',
      remarks: '' // Keep remarks blank but editable
    }));
  };

  // Calculate suggested quantity based on current stock and reorder levels
  const calculateRequiredQuantity = (item) => {
    const currentStock = parseInt(item.quantity) || 0;
    const minStock = parseInt(item.minStock) || 10;
    const maxStock = parseInt(item.maxStock) || 50;

    // Suggest restocking to maximum level
    return Math.max(maxStock - currentStock, minStock);
  };

  const handleRepairChoice = (choice) => {
    console.log(`Selected repair type: ${choice}`);
    // Add your logic here for handling the choice
    setShowRepairModal(false);
    // You can add navigation or other logic here
  };

  const closeModal = () => {
    setShowRequisitionModal(false);
    setShowRepairModal(false);
    setShowOfficeSupplyForm(false);
    setShowOtherSupplyForm(false); // NEW: Close other supply form too
  };

  // Process supplies data for pie chart
  const getSupplyStatusData = () => {
    if (!suppliesData.length) {
      return [
        { name: 'Normal', value: 15, color: supplyColors[0] },
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

  // Process equipment data for pie chart
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

  // Minimalist label function for Pie Charts
  const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = (innerRadius + outerRadius) / 2;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

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
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Clean tooltip for Pie Charts
  const renderTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <div style={{
          backgroundColor: '#333',
          padding: '10px',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
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

  // Simple hover effect for Pie Charts
  const onPieEnter = (data, index, setActiveIndex) => {
    setActiveIndex(index);
  };

  const onPieLeave = (setActiveIndex) => {
    setActiveIndex(null);
  };

  const supplyChartData = getSupplyStatusData();
  const equipmentChartData = getEquipmentStatusData();

  // NEW: Custom Tooltip for Line Charts
  const renderLineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: '#333',
          padding: '10px',
          border: 'none',
          borderRadius: '4px',
          color: 'white',
          fontSize: '12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
        }}>
          <p className="label">{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed(2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };
  // END NEW: Custom Tooltip for Line Charts

  return (
    <section className="dashboard-content-area">
      <div className="dashboard-grid">
        {/* Top Row: Line Graphs */}
        <div className="graph-card line-graph-1">
          <h3>Supplies Forecast (Next 12 Months)</h3> {/* Updated title */}
          <div style={{ width: '100%', height: '280px' }}>
            {loading ? (
              <div className="graph-placeholder">Loading supplies forecast...</div>
            ) : error ? (
              <div className="graph-placeholder">Error loading data</div>
            ) : suppliesForecastData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={suppliesForecastData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="date" stroke="#888888" tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
                  <YAxis stroke="#888888" />
                  <Tooltip content={renderLineTooltip} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="quantity"
                    stroke="#82ca9d"
                    activeDot={{ r: 8 }}
                    name="Forecasted Quantity"
                  />
                  <Line
                    type="monotone"
                    dataKey="lower_bound"
                    stroke="#8884d8"
                    strokeDasharray="5 5"
                    name="Lower Bound"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="#ffc658"
                    strokeDasharray="5 5"
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
          <h3>Equipment Forecast (Next 12 Months)</h3> {/* Updated title */}
          <div style={{ width: '100%', height: '280px' }}>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#333333" />
                  <XAxis dataKey="date" stroke="#888888" tickFormatter={(tick) => new Date(tick).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })} />
                  <YAxis stroke="#888888" />
                  <Tooltip content={renderLineTooltip} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="quantity"
                    stroke="#82ca9d"
                    activeDot={{ r: 8 }}
                    name="Forecasted Quantity"
                  />
                  <Line
                    type="monotone"
                    dataKey="lower_bound"
                    stroke="#8884d8"
                    strokeDasharray="5 5"
                    name="Lower Bound"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="upper_bound"
                    stroke="#ffc658"
                    strokeDasharray="5 5"
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

        {/* Middle Row: Pie Charts with Status Tables */}
        <div className="graph-card pie-graph-1">
          <h3>Supply Status Distribution</h3>
          <div style={{ display: 'flex', gap: '20px', height: '280px' }}>
            {/* Pie Chart */}
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
                      label={renderLabel}
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
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            {/* Status Table */}
            <div style={{ flex: '0 0 250px' }}>
              <div className="status-table-container">
                <h4 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
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
                      return data.map((item, index) => (
                        <tr key={index}>
                          <td style={{ color: item.color, fontWeight: 'bold' }}>
                            {item.name}
                          </td>
                          <td>{item.value}</td>
                          <td>{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%</td>
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
            {/* Pie Chart */}
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
                      label={renderLabel}
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
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            {/* Status Table */}
            <div style={{ flex: '0 0 250px' }}>
              <div className="status-table-container">
                <h4 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>
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
                      return data.map((item, index) => (
                        <tr key={index}>
                          <td style={{ color: item.color, fontWeight: 'bold' }}>
                            {item.name}
                          </td>
                          <td>{item.value}</td>
                          <td>{total > 0 ? ((item.value / total) * 100).toFixed(1) : 0}%</td>
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
            <button
              className="generate-button"
              onClick={handleGenerateRequisition}
              style={{ cursor: 'pointer' }}
            >
              Generate Requisition Form
            </button>
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
            <button
              className="generate-button"
              onClick={handleGenerateRepair}
              style={{ cursor: 'pointer' }}
            >
              Generate Repair Form
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
              <button
                onClick={() => handleRepairChoice('MAINTENANCE REQUEST')}
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
                MAINTENANCE REQUEST
              </button>
              <button
                onClick={() => handleRepairChoice('REPAIR REQUEST')}
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
                REPAIR REQUEST
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

      {/* Office Supply Requisition Form */}
      {showOfficeSupplyForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
          overflow: 'auto',
          padding: '20px'
        }}>
          <div className="requisition-form-modal" style={{
            backgroundColor: 'white',
            padding: '40px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
            fontFamily: 'Arial, sans-serif'
          }}>
            <style>{`
              .requisition-form-modal * {
                color: black !important;
              }
              .requisition-form-modal input {
                width: 100% !important;
                border: none !important;
                outline: none !important;
                font-size: 12px !important;
                color: black !important;
                background-color: transparent !important;
                font-family: Arial, sans-serif !important;
              }
              .requisition-form-modal input:focus {
                color: black !important;
              }
              .requisition-form-modal .requisition-input-filled {
                background-color: #f0f8ff !important;
              }
              .requisition-form-modal h2,
              .requisition-form-modal h3,
              .requisition-form-modal th,
              .requisition-form-modal td,
              .requisition-form-modal div,
              .requisition-form-modal span,
              .requisition-form-modal strong {
                color: black !important;
              }

              /* Print-specific styles */
              @media print {
                .print-hidden {
                  display: none !important;
                }
                .requisition-form-modal {
                  box-shadow: none !important;
                  border-radius: 0 !important;
                  padding: 20px !important;
                  width: 100% !important;
                  max-width: none !important;
                  max-height: none !important;
                  overflow: visible !important;
                }
                .requisition-form-modal .requisition-input-filled {
                  background-color: transparent !important;
                }
                body {
                  background: white !important;
                }
                .requisition-form-modal input {
                  background-color: transparent !important;
                }
              }
            `}</style>
            {/* Form Header */}
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <h2 style={{
                textDecoration: 'underline',
                margin: '0 0 20px 0',
                fontSize: '18px',
                fontWeight: 'bold'
              }}>
                REQUISITION FORM
              </h2>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                margin: '20px 0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '20px',
                    height: '15px',
                    backgroundColor: 'black',
                    display: 'inline-block',
                    position: 'relative'
                  }}>
                    <span style={{
                      color: 'white',
                      fontSize: '12px',
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontWeight: 'bold'
                    }}>✓</span>
                  </div>
                  <span style={{ fontSize: '14px' }}>Office Supplies</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '20px',
                    height: '15px',
                    border: '2px solid black',
                    display: 'inline-block'
                  }}></div>
                  <span style={{ fontSize: '14px' }}>Other Supplies & Materials</span>
                </div>
              </div>
            </div>

            {/* Department Header */}
            <div style={{
              textAlign: 'center',
              fontWeight: 'bold',
              fontSize: '16px',
              marginBottom: '20px',
              textDecoration: 'underline'
            }}>
              MAINTENANCE and ENGINEERING DIVISION
            </div>

            {/* Table */}
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '2px solid black',
              marginBottom: '30px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    width: '10%'
                  }}>QTY</th>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    width: '15%'
                  }}>UNIT</th>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    width: '50%'
                  }}>DESCRIPTION</th>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    width: '25%'
                  }}>REMARKS</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const requisitionData = getRequisitionData();
                  const totalRows = 15;

                  return [...Array(totalRows)].map((_, index) => {
                    const itemData = index < requisitionData.length ? requisitionData[index] : null;

                    return (
                      <tr key={index}>
                        <td style={{
                          border: '1px solid black',
                          padding: '8px',
                          height: '25px'
                        }}>
                          <input
                            type="text"
                            className={`${itemData ? 'requisition-input-filled' : ''}`}
                            defaultValue={itemData ? itemData.qty : ''}
                            placeholder=""
                          />
                        </td>
                        <td style={{
                          border: '1px solid black',
                          padding: '8px',
                          height: '25px'
                        }}>
                          <input
                            type="text"
                            className={`${itemData ? 'requisition-input-filled' : ''}`}
                            defaultValue={itemData ? itemData.unit : ''}
                            placeholder=""
                          />
                        </td>
                        <td style={{
                          border: '1px solid black',
                          padding: '8px',
                          height: '25px'
                        }}>
                          <input
                            type="text"
                            className={`${itemData ? 'requisition-input-filled' : ''}`}
                            defaultValue={itemData ? itemData.description : ''}
                            placeholder=""
                          />
                        </td>
                        <td style={{
                          border: '1px solid black',
                          padding: '8px',
                          height: '25px'
                        }}>
                          <input
                            type="text"
                            className={`${itemData ? 'requisition-input-filled' : ''}`}
                            defaultValue={itemData ? itemData.remarks : ''}
                            placeholder=""
                          />
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>

            {/* Form Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ fontSize: '12px' }}>
                <strong>Purpose:</strong>
                <span style={{ marginLeft: '50px', fontSize: '11px', fontStyle: 'italic' }}>
                  To certify: accomplish the necessary documents at the right time.
                </span>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '40px',
              marginBottom: '30px'
            }}>
              <div>
                <div style={{ marginBottom: '15px', fontSize: '12px' }}>
                  <strong>Requisitioner:</strong>
                </div>
                <div style={{ marginBottom: '10px', fontSize: '12px' }}>
                  <strong>Engr. Jayson Valeroso</strong>
                </div>
                <div style={{ fontSize: '11px', marginBottom: '5px' }}>
                  MED Chief
                </div>
                <div style={{
                  borderBottom: '1px solid black',
                  width: '150px',
                  fontSize: '10px',
                  paddingTop: '20px'
                }}>
                  (Date)
                </div>

                <div style={{ marginTop: '20px', fontSize: '12px' }}>
                  <strong>Receive:</strong>
                </div>
                <div style={{
                  borderBottom: '1px solid black',
                  width: '150px',
                  marginTop: '30px'
                }}>
                </div>
              </div>

              <div>
                <div style={{ marginBottom: '15px', fontSize: '12px' }}>
                  <strong>Approved by:</strong>
                </div>
                <div style={{
                  borderBottom: '1px solid black',
                  width: '200px',
                  marginBottom: '5px',
                  paddingTop: '20px'
                }}>
                </div>
                <div style={{ fontSize: '10px', textAlign: 'center', width: '200px' }}>
                  Signature Over Printed Name/Date
                </div>
                <div style={{ fontSize: '10px', textAlign: 'center', width: '200px' }}>
                  Chief Head of Office
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="print-hidden" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '20px'
            }}>
              <button
                onClick={closeModal}
                style={{
                  backgroundColor: '#666',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Close
              </button>

              <button
                onClick={() => window.print()}
                style={{
                  backgroundColor: '#4CAF50',
                  color: 'white',
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                🖨️ Print Requisition
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Supply Requisition Form */}
      {showOtherSupplyForm && (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    overflow: 'auto',
    padding: '20px'
  }}>
    <div className="requisition-form-modal" style={{
      backgroundColor: 'white',
      padding: '40px',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '800px',
      maxHeight: '90vh',
      overflow: 'auto',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <style>{`
        .requisition-form-modal * {
          color: black !important;
        }
        .requisition-form-modal input {
          width: 100% !important;
          border: none !important;
          outline: none !important;
          font-size: 12px !important;
          color: black !important;
          background-color: transparent !important;
          font-family: Arial, sans-serif !important;
        }
        .requisition-form-modal input:focus {
          color: black !important;
        }
        .requisition-form-modal .requisition-input-filled {
          background-color: #f0f8ff !important;
        }
        .requisition-form-modal h2,
        .requisition-form-modal h3,
        .requisition-form-modal th,
        .requisition-form-modal td,
        .requisition-form-modal div,
        .requisition-form-modal span,
        .requisition-form-modal strong {
          color: black !important;
        }

        /* Print-specific styles */
        @media print {
          .print-hidden {
            display: none !important;
          }
          .requisition-form-modal {
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 20px !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            overflow: visible !important;
          }
          .requisition-form-modal .requisition-input-filled {
            background-color: transparent !important;
          }
          body {
            background: white !important;
          }
          .requisition-form-modal input {
            background-color: transparent !important;
          }
        }
      `}</style>
      {/* Form Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{
          textDecoration: 'underline',
          margin: '0 0 20px 0',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          REQUISITION FORM
        </h2>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '20px 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '20px',
              height: '15px',
              border: '2px solid black',
              display: 'inline-block'
            }}></div>
            <span style={{ fontSize: '14px' }}>Office Supplies</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '20px',
              height: '15px',
              backgroundColor: 'black',
              display: 'inline-block',
              position: 'relative'
            }}>
              <span style={{
                color: 'white',
                fontSize: '12px',
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                fontWeight: 'bold'
              }}>✓</span>
            </div>
            <span style={{ fontSize: '14px' }}>Other Supplies & Materials</span>
          </div>
        </div>
      </div>

      {/* Department Header */}
      <div style={{
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '16px',
        marginBottom: '20px',
        textDecoration: 'underline'
      }}>
        MAINTENANCE and ENGINEERING DIVISION
      </div>

      {/* Table */}
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        border: '2px solid black',
        marginBottom: '30px'
      }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{
              border: '1px solid black',
              padding: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              width: '10%'
            }}>QTY</th>
            <th style={{
              border: '1px solid black',
              padding: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              width: '15%'
            }}>UNIT</th>
            <th style={{
              border: '1px solid black',
              padding: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              width: '50%'
            }}>DESCRIPTION</th>
            <th style={{
              border: '1px solid black',
              padding: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              width: '25%'
            }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            const requisitionData = getOtherRequisitionData();
            const totalRows = 15;

            return [...Array(totalRows)].map((_, index) => {
              const itemData = index < requisitionData.length ? requisitionData[index] : null;

              return (
                <tr key={index}>
                  <td style={{
                    border: '1px solid black',
                    padding: '8px',
                    height: '25px'
                  }}>
                    <input
                      type="text"
                      className={`${itemData ? 'requisition-input-filled' : ''}`}
                      defaultValue={itemData ? itemData.qty : ''}
                      placeholder=""
                    />
                  </td>
                  <td style={{
                    border: '1px solid black',
                    padding: '8px',
                    height: '25px'
                  }}>
                    <input
                      type="text"
                      className={`${itemData ? 'requisition-input-filled' : ''}`}
                      defaultValue={itemData ? itemData.unit : ''}
                      placeholder=""
                    />
                  </td>
                  <td style={{
                    border: '1px solid black',
                    padding: '8px',
                    height: '25px'
                  }}>
                    <input
                      type="text"
                      className={`${itemData ? 'requisition-input-filled' : ''}`}
                      defaultValue={itemData ? itemData.description : ''}
                      placeholder=""
                    />
                  </td>
                  <td style={{
                    border: '1px solid black',
                    padding: '8px',
                    height: '25px'
                  }}>
                    <input
                      type="text"
                      className={`${itemData ? 'requisition-input-filled' : ''}`}
                      defaultValue={itemData ? itemData.remarks : ''}
                      placeholder=""
                    />
                  </td>
                </tr>
              );
            });
          })()}
        </tbody>
      </table>

      {/* Form Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ fontSize: '12px' }}>
          <strong>Purpose:</strong>
          <span style={{ marginLeft: '50px', fontSize: '11px', fontStyle: 'italic' }}>
            To certify: accomplish the necessary documents at the right time.
          </span>
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '40px',
        marginBottom: '30px'
      }}>
        <div>
          <div style={{ marginBottom: '15px', fontSize: '12px' }}>
            <strong>Requisitioner:</strong>
          </div>
          <div style={{ marginBottom: '10px', fontSize: '12px' }}>
            <strong>Engr. Jayson Valeroso</strong>
          </div>
          <div style={{ fontSize: '11px', marginBottom: '5px' }}>
            MED Chief
          </div>
          <div style={{
            borderBottom: '1px solid black',
            width: '150px',
            fontSize: '10px',
            paddingTop: '20px'
          }}>
            (Date)
          </div>

          <div style={{ marginTop: '20px', fontSize: '12px' }}>
            <strong>Receive:</strong>
          </div>
          <div style={{
            borderBottom: '1px solid black',
            width: '150px',
            marginTop: '30px'
          }}>
          </div>
        </div>

        <div>
          <div style={{ marginBottom: '15px', fontSize: '12px' }}>
            <strong>Approved by:</strong>
          </div>
          <div style={{
            borderBottom: '1px solid black',
            width: '200px',
            marginBottom: '5px',
            paddingTop: '20px'
          }}>
          </div>
          <div style={{ fontSize: '10px', textAlign: 'center', width: '200px' }}>
            Signature Over Printed Name/Date
          </div>
          <div style={{ fontSize: '10px', textAlign: 'center', width: '200px' }}>
            Chief Head of Office
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="print-hidden" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: '20px'
      }}>
        <button
  onClick={() => setShowOtherSupplyForm(false)}
  style={{
    backgroundColor: '#666',
    color: 'white',
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  }}
>
  Close
</button>

        <button
          onClick={() => window.print()}
          style={{
            backgroundColor: '#4CAF50',
            color: 'white',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          🖨️ Print Requisition
        </button>
      </div>
    </div>
  </div>
)}

    </section>
  );
}

export default DashboardPage;
