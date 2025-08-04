import React, { useState } from 'react';
import './EquipmentPage.css';

function EquipmentPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const equipmentData = [
    { itemCode: 'MED-E-34561', quantity: 1, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34562', quantity: 11, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34563', quantity: 12, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34564', quantity: 13, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34565', quantity: 2, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34566', quantity: 14, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34567', quantity: 15, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34568', quantity: 16, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34569', quantity: 17, unit: 'UNIT', description: '3HP GOULD PUMP' },
    { itemCode: 'MED-E-34560', quantity: 18, unit: 'UNIT', description: '3HP GOULD PUMP' }
  ];

  const filteredEquipment = equipmentData.filter(item =>
    item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="equipment-page-container">
      <div className="equipment-header">
        <h2 className="page-title">Equipment Inventory</h2>
        <div className="table-controls">
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search equipment..."
              className="search-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <svg className="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 15L21 21M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>

      <table className="equipment-table">
        <thead>
          <tr>
            <th>Item Code</th>
            <th>Quantity</th>
            <th>Unit</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {filteredEquipment.map((equipment, index) => (
            <tr key={index}>
              <td>{equipment.itemCode}</td>
              <td>{equipment.quantity}</td>
              <td>{equipment.unit}</td>
              <td>{equipment.description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <button className="add-equipment-button">Add New Equipment</button>
    </div>
  );
}

export default EquipmentPage;