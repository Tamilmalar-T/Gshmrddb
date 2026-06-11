import { useState, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { DecodeHintType } from '@zxing/library';
import { API_URL } from './config';
import './Barcode.css';

function Barcode() {
  const [isScanning, setIsScanning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scannedResults, setScannedResults] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [manualCode, setManualCode] = useState("");
  const fileInputRef = useRef(null);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (manualCode.trim()) {
        const codes = manualCode.trim().split(/[\s,]+/).filter(c => c);
        if (codes.length > 0) {
          setScannedResults(prev => [...prev, [...new Set(codes)]]);
        }
        setManualCode("");
      }
    }
  };

  const handleBarcodeUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    setSelectedFiles(prev => [...prev, ...files]);
    setIsScanning(true);

    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    const codeReader = new BrowserMultiFormatReader(hints);
    const newResults = [];
    let errorCount = 0;

    for (const file of files) {
      try {
        const imageUrl = URL.createObjectURL(file);
        let foundCodes = false;

        // Try the native BarcodeDetector API first as it can find multiple codes in one image
        if ('BarcodeDetector' in window) {
          try {
            // Do not specify formats explicitly to avoid crashing if the OS doesn't support a specific one
            const barcodeDetector = new window.BarcodeDetector();
            const img = new Image();
            img.src = imageUrl;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
            const barcodes = await barcodeDetector.detect(img);
            if (barcodes.length > 0) {
              barcodes.forEach(b => newResults.push(b.rawValue));
              foundCodes = true;
            }
          } catch (err) {
            console.error("Native BarcodeDetector error:", err);
          }
        }

        // Fallback: If native API fails or only finds 0-1 barcodes, brute-force slice the image!
        if (!foundCodes || newResults.length < 2) {
            const img = new Image();
            img.src = imageUrl;
            await new Promise((resolve) => {
              img.onload = resolve;
              img.onerror = resolve;
            });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            
            const scanCanvas = async (cvs) => {
               try {
                  const dataUrl = cvs.toDataURL('image/jpeg');
                  const res = await codeReader.decodeFromImageUrl(dataUrl);
                  if (res) newResults.push(res.getText());
               } catch(e) { /* ignore NotFoundException */ }
            };

            // 1. Scan Full Image
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            await scanCanvas(canvas);

            // 2. Scan Image Slices (forces ZXing to find multiple barcodes in different regions)
            if (img.width > 200 && img.height > 200) {
              const slices = [
                { x: 0, y: 0, w: img.width, h: img.height / 2 }, // Top Half
                { x: 0, y: img.height / 2, w: img.width, h: img.height / 2 }, // Bottom Half
                { x: 0, y: img.height / 4, w: img.width, h: img.height / 2 }, // Middle Horizontal
                { x: 0, y: 0, w: img.width / 2, h: img.height }, // Left Half
                { x: img.width / 2, y: 0, w: img.width / 2, h: img.height }, // Right Half
                { x: img.width / 4, y: 0, w: img.width / 2, h: img.height } // Middle Vertical
              ];

              for (const slice of slices) {
                 canvas.width = slice.w;
                 canvas.height = slice.h;
                 ctx.drawImage(img, slice.x, slice.y, slice.w, slice.h, 0, 0, slice.w, slice.h);
                 await scanCanvas(canvas);
              }
            }
        }

        if (newResults.length === 0) {
           errorCount++;
        }

        URL.revokeObjectURL(imageUrl);
      } catch (err) {
        console.error("Barcode scan error for file:", file.name, err);
        errorCount++;
      }
    }

    if (newResults.length > 0) {
      // Safety net: split any commas just in case the API returned a concatenated string
      const splitResults = newResults.flatMap(r => 
        typeof r === 'string' ? r.split(/[\s,]+/).filter(x => x) : [r]
      );
      // Deduplicate within the same batch
      const uniqueBatch = [...new Set(splitResults)];
      setScannedResults(prev => [...prev, uniqueBatch]);
    }
    
    if (errorCount > 0) {
      alert(`Could not detect a barcode in ${errorCount} of the uploaded image(s). Please ensure the images are clear.`);
    }

    setIsScanning(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSaveToDatabase = async () => {
    if (scannedResults.length === 0) return;

    setIsSaving(true);
    try {
      // Format the data into an array of objects: { "Barcode 1": "...", "Barcode 2": "..." }
      const formattedBarcodes = scannedResults.map(row => {
        const obj = {};
        row.forEach((code, index) => {
          obj[`Barcode ${index + 1}`] = code;
        });
        return obj;
      });

      const formData = new FormData();
      formData.append("barcodes", JSON.stringify(formattedBarcodes));
      
      selectedFiles.forEach(file => {
        formData.append("files", file);
      });

      const response = await fetch(`${API_URL}/api/barcodes/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (data.success) {
        alert("Successfully saved to Database and Google Drive!");
        setScannedResults([]);
        setSelectedFiles([]);
      } else {
        alert("Failed to save: " + data.message);
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("An error occurred while saving to the database.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="export-page-container" style={{ padding: '20px' }}>
      <div className="export-header-row" style={{ marginBottom: '20px' }}>
        <div>
          <h2>Barcode Scanner</h2>
          <p>Upload barcode images to keep a list of detected code numbers.</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '30px' }}>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isScanning}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', 
            background: '#4f46e5', color: 'white', border: 'none', borderRadius: '5px', 
            fontSize: '16px', fontWeight: 'bold', cursor: isScanning ? 'not-allowed' : 'pointer',
            opacity: isScanning ? 0.7 : 1
          }}
        >
          {isScanning ? 'Scanning...' : '📷 Upload Barcode'}
        </button>
        <span style={{ color: '#64748b' }}>Supports PNG, JPG, and JPEG</span>
        <input 
          type="file" 
          accept="image/*" 
          multiple
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleBarcodeUpload}
        />
      </div>

  

      {scannedResults.length > 0 && (() => {
        const maxColumns = Math.max(1, ...scannedResults.map(r => r.length));
        return (
          <div style={{ overflowX: 'auto' }}>
            <table border="1" cellPadding="10" style={{ borderCollapse: 'collapse', width: '100%', minWidth: '400px', textAlign: 'left', background: 'white', border: '1px solid #cbd5e1' }}>
              <thead>
                <tr style={{ background: '#f1f5f9' }}>
                  <th style={{ width: '80px', borderBottom: '1px solid #cbd5e1', borderRight: '1px solid #cbd5e1' }}>SNO</th>
                  {Array.from({ length: maxColumns }).map((_, i) => (
                    <th key={i} style={{ borderBottom: '1px solid #cbd5e1', borderRight: i < maxColumns - 1 ? '1px solid #cbd5e1' : 'none' }}>
                      Barcode {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                  {scannedResults.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      <td style={{ fontWeight: 'bold', color: '#64748b', borderRight: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>{rowIndex + 1}</td>
                      {Array.from({ length: maxColumns }).map((_, colIndex) => (
                        <td key={colIndex} style={{ color: '#4f46e5', fontWeight: 'bold', borderBottom: '1px solid #e2e8f0', borderRight: colIndex < maxColumns - 1 ? '1px solid #cbd5e1' : 'none' }}>
                          {row[colIndex] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button 
                onClick={handleSaveToDatabase}
                disabled={isSaving}
                style={{
                  background: '#10b981', color: 'white', border: 'none', borderRadius: '5px', 
                  padding: '10px 24px', fontSize: '16px', fontWeight: 'bold', 
                  cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1
                }}
              >
                {isSaving ? 'Saving...' : '💾 Save to Database'}
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default Barcode;
