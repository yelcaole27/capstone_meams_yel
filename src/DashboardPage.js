import React from 'react';
import './DashboardPage.css';

function DashboardPage() {
  const understockData = [
    { itemCode: 'MED-12345', stockNo: 1, itemName: 'Sample A', category: 'Category A' },
    { itemCode: 'MED-12346', stockNo: 5, itemName: 'Sample B', category: 'Category B' },
    { itemCode: 'MED-12347', stockNo: 3, itemName: 'Sample C', category: 'Category C' },
    { itemCode: 'MED-12348', stockNo: 10, itemName: 'Sample D', category: 'Category D' },
    { itemCode: 'MED-12349', stockNo: 2, itemName: 'Sample E', category: 'Category E' },
  ];

  const equipmentLifeData = [
    { equipmentId: 'EQ-001', name: 'Drill Press', department: 'Workshop', lastMaintained: '2020-11-01' },
    { equipmentId: 'EQ-005', name: 'Welding Machine', department: 'Fabrication', lastMaintained: '2021-03-10' },
    { equipmentId: 'EQ-010', name: 'Compressor', department: 'Maintenance', lastMaintained: '2019-09-20' },
  ];

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
          <div className="graph-placeholder">Pie Graph 1 Data</div>
        </div>
        <div className="graph-card pie-graph-2">
          <h3>Equipment Status Breakdown</h3>
          <div className="graph-placeholder">Pie Graph 2 Data</div>
        </div>

        {/* Bottom Row: Tables - Now in a new flex container */}
        <div className="dashboard-tables-row"> {/* New wrapper for the tables */}
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
                {understockData.map((item, index) => (
                  <tr key={index}>
                    <td>{item.itemCode}</td>
                    <td>{item.stockNo}</td>
                    <td>{item.itemName}</td>
                    <td>{item.category}</td>
                  </tr>
                ))}
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
                  <th>Department</th>
                  <th>Last Maintained</th>
                </tr>
              </thead>
              <tbody>
                {equipmentLifeData.map((item, index) => (
                  <tr key={index}>
                    <td>{item.equipmentId}</td>
                    <td>{item.name}</td>
                    <td>{item.department}</td>
                    <td>{item.lastMaintained}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="generate-button">Generate Repair Form</button>
          </div>
        </div> {/* End of dashboard-tables-row */}

      </div>
    </section>
  );
}

export default DashboardPage;