import React, { useState } from 'react';

function DynamicPurchaseForm({ initialData, onClose }) {
  const [rows, setRows] = useState(() => {
    if (initialData && initialData.length > 0) {
      return initialData;
    }
    return Array(20).fill(null).map(() => ({
      quantity: '',
      equipmentName: '',
      description: '',
      amount: ''
    }));
  });

  const [deliveryDate, setDeliveryDate] = useState('');

  const addRow = () => {
    setRows([...rows, { quantity: '', equipmentName: '', description: '', amount: '' }]);
  };

  const deleteRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const ROWS_PER_PAGE = 20;
  const paginatedRows = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
    paginatedRows.push(rows.slice(i, i + ROWS_PER_PAGE));
  }

  const renderHeader = () => (
    <div style={{ border: 'none' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px', border: 'none' }}>
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '18px',
          fontWeight: 'bold',
          color: 'black',
          textAlign: 'center',
          textDecoration: 'none',
          borderBottom: 'none'
        }}>
          PURCHASE FORM
        </h2>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '20px 0',
          maxWidth: '100%',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Place of Delivery:</span>
            <span style={{ 
              textDecoration: 'underline',
              fontWeight: 'bold',
              minWidth: '150px'
            }}>
              Universidad de Manila
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span>Date of Delivery:</span>
            <div style={{
              borderBottom: '2px solid black',
              width: '150px',
              minHeight: '20px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <input
                type="text"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                style={{
                  border: 'none',
                  outline: 'none',
                  width: '100%',
                  fontSize: '12px',
                  textAlign: 'center',
                  backgroundColor: 'transparent'
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: '14px',
        marginBottom: '15px',
        textDecoration: 'underline',
        color: 'black'
      }}>
        MAINTENANCE and ENGINEERING DIVISION
      </div>
    </div>
  );

  const renderFooter = () => (
    <div className="form-footer" style={{ marginTop: '20px' }}>
      <div style={{
        fontSize: '10px',
        marginBottom: '20px',
        textAlign: 'left'
      }}>
        <strong>In case of failure to make the full delivery within the time specified above, a penalty of one-tenth (1/10)</strong><br />
        <strong>of one (1) percent for every day of delay shall be imposed.</strong>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        marginTop: '30px'
      }}>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: '12px', marginBottom: '5px' }}>
            <strong>Conforme:</strong>
          </div>
          <div style={{
            borderBottom: '2px solid black',
            width: '250px',
            height: '40px',
            marginBottom: '5px'
          }}></div>
          <div style={{ 
            fontSize: '10px', 
            textAlign: 'center',
            width: '250px'
          }}>
            <strong>Signature Over Printed Name/Date</strong>
          </div>
          <div style={{ 
            fontSize: '10px', 
            textAlign: 'center',
            width: '250px'
          }}>
            <strong>(Date)</strong>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="modal-overlay"
      style={{
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
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }
        
        .modal-content {
          background-color: white !important;
        }
        
        .modal-content * {
          color: black !important;
        }
        
        .modal-content h2 {
          color: black !important;
        }
        
        h2 {
          color: black !important;
        }
        
        input[type="text"] {
          background: white !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          -webkit-appearance: none !important;
          -moz-appearance: none !important;
          appearance: none !important;
          color: black !important;
        }
        
        input[type="text"]:focus {
          outline: none !important;
          border: none !important;
          box-shadow: none !important;
        }
        
        table tbody tr {
          background-color: white !important;
        }
        
        table tbody td {
          background-color: white !important;
        }
        
        @media print {
          @page {
            size: letter portrait;
            margin: 0.5in;
          }
          
          body * {
            visibility: hidden !important;
          }
          
          .modal-overlay,
          .modal-overlay * {
            visibility: visible !important;
          }
          
          html, body {
            height: auto !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          .modal-overlay {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            display: block !important;
            background: white !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            border: none !important;
            outline: none !important;
          }
          
          .modal-content {
            position: static !important;
            max-width: 100% !important;
            max-height: none !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
            height: auto !important;
            border: none !important;
            outline: none !important;
          }
          
          .print-hidden {
            display: none !important;
            visibility: hidden !important;
          }
          
          .print-only {
            display: block !important;
            visibility: visible !important;
          }
          
          .print-page-wrapper {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            visibility: visible !important;
            border: none !important;
            outline: none !important;
          }
          
          .print-page-wrapper * {
            outline: none !important;
          }
          
          .print-page-wrapper > div {
            border: none !important;
            outline: none !important;
          }
          
          table, table * {
            border: inherit !important;
          }
          
          .print-page-wrapper:last-of-type {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            visibility: visible !important;
            border: 1px solid black !important;
          }
          
          thead, tbody, tr {
            visibility: visible !important;
          }
          
          td, th {
            border: 1px solid black !important;
            padding: 4px !important;
          }
          
          thead {
            background: transparent !important;
          }
          
          th {
            background: transparent !important;
          }
          
          input {
            border: none !important;
            background: transparent !important;
            color: black !important;
            font-size: 12px !important;
            padding: 4px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            visibility: visible !important;
            font-family: Arial, sans-serif !important;
          }
          
          h2 {
            color: black !important;
            visibility: visible !important;
            text-align: center !important;
          }
          
          h2, span, div, strong {
            color: black !important;
          }
        }
        
        @media screen {
          .print-page-wrapper {
            margin-bottom: 40px;
            padding-bottom: 40px;
            border-bottom: 3px dashed #999;
          }
          
          .print-only {
            display: none !important;
          }
          
          .print-page-wrapper:last-of-type {
            border-bottom: none;
            margin-bottom: 0;
            padding-bottom: 0;
          }
          
          input {
            background: transparent !important;
            border: none !important;
            outline: none !important;
            box-shadow: none !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
          }
          
          input:focus {
            outline: none !important;
            box-shadow: none !important;
            border: none !important;
          }
          
          td input, th input {
            border: none !important;
            outline: none !important;
          }
        }
        
        input {
          background: transparent !important;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        
        input:focus {
          outline: none !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        .modal-content * { 
          color: black !important; 
        }
      `}</style>
      
      <div className="modal-content" style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        width: '90%',
        maxWidth: '900px',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        fontFamily: 'Arial, sans-serif',
        position: 'relative',
        color: 'black'
      }}>
        
        <button
          onClick={onClose}
          className="print-hidden"
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '28px',
            cursor: 'pointer',
            color: '#666',
            width: '35px',
            height: '35px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            fontWeight: 'bold',
            zIndex: 10
          }}
        >
          ×
        </button>

        {paginatedRows.map((pageRows, pageIndex) => (
          <div key={pageIndex} className="print-page-wrapper">
            {renderHeader()}

            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid black',
              marginBottom: '20px'
            }}>
              <thead>
                <tr style={{ backgroundColor: 'white' }}>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    width: '10%',
                    textAlign: 'center'
                  }}>Qty.</th>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    width: '30%',
                    textAlign: 'center'
                  }}>Equipment Name</th>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    width: '40%',
                    textAlign: 'center'
                  }}>Description</th>
                  <th style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    width: '20%',
                    textAlign: 'center'
                  }}>Amount</th>
                  <th className="print-hidden" style={{
                    border: '1px solid black',
                    padding: '8px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    width: '10%',
                    textAlign: 'center'
                  }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, localIndex) => {
                  const globalIndex = pageIndex * ROWS_PER_PAGE + localIndex;
                  return (
                    <tr key={globalIndex}>
                      <td style={{
                        border: '1px solid black',
                        padding: '4px',
                        height: '28px'
                      }}>
                        <input
                          type="text"
                          value={row.quantity}
                          onChange={(e) => updateRow(globalIndex, 'quantity', e.target.value)}
                          style={{
                            backgroundColor: row.quantity ? '#f0f8ff' : 'transparent'
                          }}
                        />
                      </td>
                      <td style={{
                        border: '1px solid black',
                        padding: '4px',
                        height: '28px'
                      }}>
                        <input
                          type="text"
                          value={row.equipmentName}
                          onChange={(e) => updateRow(globalIndex, 'equipmentName', e.target.value)}
                          style={{
                            backgroundColor: row.equipmentName ? '#f0f8ff' : 'transparent'
                          }}
                        />
                      </td>
                      <td style={{
                        border: '1px solid black',
                        padding: '4px',
                        height: '28px'
                      }}>
                        <input
                          type="text"
                          value={row.description}
                          onChange={(e) => updateRow(globalIndex, 'description', e.target.value)}
                          style={{
                            backgroundColor: row.description ? '#f0f8ff' : 'transparent'
                          }}
                        />
                      </td>
                      <td style={{
                        border: '1px solid black',
                        padding: '4px',
                        height: '28px'
                      }}>
                        <input
                          type="text"
                          value={row.amount}
                          onChange={(e) => updateRow(globalIndex, 'amount', e.target.value)}
                          style={{
                            backgroundColor: row.amount ? '#f0f8ff' : 'transparent'
                          }}
                        />
                      </td>
                      <td className="print-hidden" style={{
                        border: '1px solid black',
                        padding: '4px',
                        textAlign: 'center'
                      }}>
                        <button
                          onClick={() => deleteRow(globalIndex)}
                          disabled={rows.length === 1}
                          style={{
                            backgroundColor: rows.length === 1 ? '#ccc' : '#f44336',
                            color: 'white',
                            border: 'none',
                            padding: '4px 8px',
                            borderRadius: '3px',
                            cursor: rows.length === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '11px'
                          }}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {pageIndex === paginatedRows.length - 1 && renderFooter()}
            
            <div className="print-only" style={{
              textAlign: 'right',
              fontSize: '10px',
              marginTop: '15px',
              color: 'black'
            }}>
              <div>Date: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              <div>Page {pageIndex + 1} of {paginatedRows.length}</div>
            </div>
          </div>
        ))}

        <div className="print-hidden" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '20px',
          gap: '10px'
        }}>
          <div style={{ fontSize: '12px', color: '#666' }}>
            Total rows: <strong>{rows.length}</strong> | Pages: <strong>{paginatedRows.length}</strong>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={addRow}
              style={{
                backgroundColor: '#FF6B35',
                color: 'white',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              ➕ Add Row
            </button>
            <button
              onClick={() => window.print()}
              style={{
                backgroundColor: '#FF6B35',
                color: '#FFFFFF',
                padding: '12px 24px',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              🖨️ Print Purchase Form ({paginatedRows.length} page{paginatedRows.length > 1 ? 's' : ''})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DynamicPurchaseForm;
