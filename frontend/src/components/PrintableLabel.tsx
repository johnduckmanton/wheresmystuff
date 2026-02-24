import React, { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  CircularProgress,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import type { Container } from '../types';
import QRCode from 'qrcode';

interface PrintableLabelProps {
  container: Container;
  qrCodeId: string;
  size?: 'small' | 'medium' | 'large';
  locationName?: string;
  roomName?: string;
}

interface LabelDimensions {
  width: number;
  height: number;
  qrSize: number;
  fontSize: number;
  nameFontSize: number;
  padding: number;
}

const getLabelDimensions = (labelSize: string): LabelDimensions => {
  const dimensions = {
    small: {
      width: 420,
      height: 432,
      qrSize: 180,
      fontSize: 12,
      nameFontSize: 18,
      padding: 20,
    },
    medium: {
      width: 432,
      height: 576,
      qrSize: 220,
      fontSize: 14,
      nameFontSize: 22,
      padding: 25,
    },
    large: {
      width: 576,
      height: 864,
      qrSize: 280,
      fontSize: 16,
      nameFontSize: 28,
      padding: 30,
    },
  };

  return dimensions[labelSize as keyof typeof dimensions] || dimensions.medium;
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const getHandlingIconData = (flag: string) => {
  const icons: Record<string, { label: string; color: string }> = {
    fragile: { label: 'FRAGILE', color: '#DC2626' },
    keep_upright: { label: 'THIS WAY UP', color: '#2563EB' },
    heavy: { label: 'HEAVY', color: '#7C3AED' },
    valuable: { label: 'VALUABLE', color: '#CA8A04' },
    priority: { label: 'PRIORITY', color: '#DC2626' },
    temperature_sensitive: { label: 'TEMP SENSITIVE', color: '#0891B2' },
  };
  return icons[flag] || null;
};

const drawHandlingIcon = (
  ctx: CanvasRenderingContext2D,
  flag: string,
  x: number,
  y: number,
  pillHeight: number
) => {
  const iconData = getHandlingIconData(flag);
  if (!iconData) return;

  // Calculate pill dimensions
  const pillWidth = pillHeight * 3.5; // Wider pill for better text fit
  const radius = pillHeight / 2;

  // Draw rounded rectangle background with light tint
  ctx.fillStyle = iconData.color + '15'; // 15 = ~8% opacity for subtle background
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + pillWidth - radius, y);
  ctx.arc(x + pillWidth - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + radius, y + pillHeight);
  ctx.arc(x + radius, y + radius, radius, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();

  // Draw border
  ctx.strokeStyle = iconData.color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw icon symbol on the left
  const iconX = x + pillHeight / 2;
  const iconY = y + pillHeight / 2;
  const symbolSize = pillHeight * 0.4;

  ctx.fillStyle = iconData.color;
  ctx.strokeStyle = iconData.color;
  ctx.lineWidth = 2.5;

  switch (flag) {
    case 'fragile':
      // Triangle warning
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - symbolSize * 0.6);
      ctx.lineTo(iconX - symbolSize * 0.6, iconY + symbolSize * 0.4);
      ctx.lineTo(iconX + symbolSize * 0.6, iconY + symbolSize * 0.4);
      ctx.closePath();
      ctx.stroke();
      ctx.fillRect(iconX - symbolSize * 0.1, iconY - symbolSize * 0.25, symbolSize * 0.2, symbolSize * 0.4);
      ctx.fillRect(iconX - symbolSize * 0.1, iconY + symbolSize * 0.25, symbolSize * 0.2, symbolSize * 0.15);
      break;

    case 'keep_upright':
      // Up arrow
      ctx.beginPath();
      ctx.moveTo(iconX, iconY - symbolSize * 0.6);
      ctx.lineTo(iconX - symbolSize * 0.5, iconY + symbolSize * 0.1);
      ctx.lineTo(iconX - symbolSize * 0.2, iconY + symbolSize * 0.1);
      ctx.lineTo(iconX - symbolSize * 0.2, iconY + symbolSize * 0.6);
      ctx.lineTo(iconX + symbolSize * 0.2, iconY + symbolSize * 0.6);
      ctx.lineTo(iconX + symbolSize * 0.2, iconY + symbolSize * 0.1);
      ctx.lineTo(iconX + symbolSize * 0.5, iconY + symbolSize * 0.1);
      ctx.closePath();
      ctx.fill();
      break;

    case 'heavy':
      // Weight symbol
      ctx.fillRect(iconX - symbolSize * 0.6, iconY - symbolSize * 0.2, symbolSize * 0.35, symbolSize * 0.4);
      ctx.fillRect(iconX - symbolSize * 0.2, iconY - symbolSize * 0.1, symbolSize * 0.4, symbolSize * 0.2);
      ctx.fillRect(iconX + symbolSize * 0.25, iconY - symbolSize * 0.2, symbolSize * 0.35, symbolSize * 0.4);
      break;

    case 'valuable':
      // Dollar sign
      ctx.font = `bold ${symbolSize * 1.8}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', iconX, iconY);
      break;

    case 'priority':
      // Exclamation mark
      ctx.fillRect(iconX - symbolSize * 0.15, iconY - symbolSize * 0.6, symbolSize * 0.3, symbolSize * 0.9);
      ctx.fillRect(iconX - symbolSize * 0.15, iconY + symbolSize * 0.45, symbolSize * 0.3, symbolSize * 0.25);
      break;

    case 'temperature_sensitive':
      // Thermometer
      ctx.beginPath();
      ctx.arc(iconX, iconY + symbolSize * 0.4, symbolSize * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(iconX - symbolSize * 0.15, iconY - symbolSize * 0.6, symbolSize * 0.3, symbolSize * 0.9);
      break;
  }

  // Draw label text - properly centered
  ctx.font = `bold ${pillHeight * 0.32}px Arial`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = iconData.color;
  ctx.fillText(iconData.label, x + pillHeight * 1.1, y + pillHeight / 2);
};

/**
 * Printable Label Component
 * Generates a printable label with QR code and container information using Canvas API
 * Matches the requirements from the specification including handling flags
 */
const PrintableLabel: React.FC<PrintableLabelProps> = ({
  container,
  qrCodeId,
  size = 'medium',
  locationName,
  roomName,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);

  useEffect(() => {
    const generateLabel = async () => {
      if (!canvasRef.current) {
        console.log('PrintableLabel: No canvas ref');
        return;
      }

      console.log('PrintableLabel: Starting label generation');
      setLoading(true);
      setError(null);

      try {
        const dimensions = getLabelDimensions(size);
        const { width, height, qrSize, fontSize, nameFontSize } = dimensions;

        const canvas = canvasRef.current;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('PrintableLabel: Could not get canvas context');
          throw new Error('Could not get canvas context');
        }

        console.log('PrintableLabel: Canvas setup complete');

        // Fill white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        // Draw outer border with rounded corners
        const borderPadding = 15;
        const borderRadius = 8;
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        drawRoundedRect(ctx, borderPadding, borderPadding, width - borderPadding * 2, height - borderPadding * 2, borderRadius);
        ctx.stroke();

        // Calculate layout
        const innerPadding = 20;
        let currentY = borderPadding + innerPadding;

        // Draw handling flag icons at the top if present (with wrapping)
        const handlingFlags = container.handlingFlags || [];
        if (handlingFlags.length > 0) {
          const pillHeight = 45; // Bigger pills
          const pillWidth = pillHeight * 3.5;
          const pillSpacing = 10;
          
          let currentX = borderPadding + innerPadding;
          let rowY = currentY;
          
          for (let i = 0; i < handlingFlags.length; i++) {
            const flag = handlingFlags[i];
            
            // Check if pill fits in current row
            if (currentX + pillWidth > width - borderPadding - innerPadding && i > 0) {
              // Move to next row
              currentX = borderPadding + innerPadding;
              rowY += pillHeight + pillSpacing;
            }
            
            drawHandlingIcon(ctx, flag, currentX, rowY, pillHeight);
            currentX += pillWidth + pillSpacing;
          }

          // Move Y position down past all pill rows
          currentY = rowY + pillHeight + 20;
        }

        // Draw horizontal line after pills
        ctx.beginPath();
        ctx.moveTo(borderPadding + innerPadding, currentY);
        ctx.lineTo(width - borderPadding - innerPadding, currentY);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        currentY += 20; // Space after line

        // Draw container name (very large, bold)
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${nameFontSize + 8}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(container.name, borderPadding + innerPadding, currentY + 20);

        currentY += 50; // Space after name

        // Draw location and room if present (same size as container name for visibility)
        if (locationName) {
          ctx.fillStyle = '#000000';
          ctx.font = `bold ${nameFontSize + 8}px Arial`;
          const locationText = roomName ? `${locationName} > ${roomName}` : locationName;
          ctx.fillText(locationText, borderPadding + innerPadding, currentY);
          currentY += 50; // Space after location
        }

        // Draw weight if present (large text)
        if (container.weight) {
          ctx.fillStyle = '#000000';
          ctx.font = `bold ${fontSize + 6}px Arial`;
          ctx.fillText(`Weight: ${container.weight}kg`, borderPadding + innerPadding, currentY);
          currentY += 35; // Space after weight
        }

        // Draw contents summary if available
        if (container.contentsSummary) {
          ctx.fillStyle = '#333333';
          ctx.font = `${fontSize}px Arial`;
          const summary = container.contentsSummary.substring(0, 50);
          ctx.fillText(summary, borderPadding + innerPadding, currentY);
          currentY += 25; // Space after summary
        }

        console.log('PrintableLabel: Starting QR code generation with ID:', qrCodeId);

        // Generate QR code with URL to authenticated container page
        // User must be logged in to view the container details
        const containerUrl = `${window.location.origin}/inventory/${container.inventoryId}/container/${qrCodeId}`;
        console.log('PrintableLabel: QR code URL:', containerUrl);

        // Generate and draw QR code
        const qrCodeDataUrl = await QRCode.toDataURL(containerUrl, {
          width: qrSize,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M', // Medium error correction for URLs
        });

        console.log('PrintableLabel: QR code generated, data URL length:', qrCodeDataUrl.length);

        const qrImage = new Image();
        console.log('PrintableLabel: Loading QR code image...');
        
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            console.error('PrintableLabel: QR code image load timeout');
            reject(new Error('QR code image load timeout'));
          }, 5000);

          qrImage.onload = () => {
            console.log('PrintableLabel: QR code image loaded successfully');
            clearTimeout(timeout);
            resolve();
          };
          qrImage.onerror = (error) => {
            console.error('PrintableLabel: QR code image load error:', error);
            clearTimeout(timeout);
            reject(error);
          };
          qrImage.src = qrCodeDataUrl;
        });

        console.log('PrintableLabel: Drawing QR code on canvas');

        const qrX = Math.round((width - qrSize) / 2);
        const qrY = height - borderPadding - innerPadding - qrSize - 50;

        // Draw horizontal line before QR section
        ctx.beginPath();
        ctx.moveTo(borderPadding + innerPadding, qrY - 20);
        ctx.lineTo(width - borderPadding - innerPadding, qrY - 20);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw QR code
        ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

        // Draw full container ID underneath QR code
        ctx.fillStyle = '#000000';
        ctx.font = `${fontSize - 2}px monospace`; // Use monospace for ID
        ctx.textAlign = 'center';
        ctx.fillText(container.id, width / 2, qrY + qrSize + 20);

        // Draw creation date at bottom left
        ctx.textAlign = 'left';
        ctx.fillStyle = '#666666';
        ctx.font = `${fontSize - 4}px Arial`;
        const createdDate = new Date(container.createdAt).toLocaleDateString();
        ctx.fillText(`Created: ${createdDate}`, borderPadding + innerPadding, height - borderPadding - innerPadding - 10);

        console.log('PrintableLabel: Converting canvas to data URL');

        // Convert canvas to data URL
        const dataUrl = canvas.toDataURL('image/png');
        setLabelUrl(dataUrl);
        setLoading(false);
        
        console.log('PrintableLabel: Label generation complete');
      } catch (err) {
        console.error('PrintableLabel: Error generating label:', err);
        setError(err instanceof Error ? err.message : 'Failed to generate label');
        setLoading(false);
      }
    };

    generateLabel();
  }, [container, qrCodeId, size, locationName, roomName]);

  const handleDownload = () => {
    if (!labelUrl) return;

    const link = document.createElement('a');
    link.href = labelUrl;
    link.download = `label-${container.name}-${size}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    if (!labelUrl) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Label - ${container.name}</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <img src="${labelUrl}" alt="Container Label" />
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  };

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color="error">{error}</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PrintIcon />
          Printable Label
        </Typography>

        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Generating label...
            </Typography>
          </Box>
        ) : labelUrl ? (
          <>
            <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'grey.50', borderRadius: 1, mb: 2 }}>
              <img 
                src={labelUrl} 
                alt="Container Label Preview" 
                style={{ maxWidth: '100%', maxHeight: '60vh', width: 'auto', height: 'auto', border: '1px solid #ddd' }} 
              />
            </Box>

            <Typography variant="body2" gutterBottom>
              <strong>Size:</strong> {size}
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Format:</strong> Print-optimized PNG
            </Typography>
            <Typography variant="body2" gutterBottom>
              <strong>Includes:</strong> QR Code, Container Name, Type, Handling Flags, Creation Date
            </Typography>
          </>
        ) : null}

        {/* Hidden canvas used for generation */}
        <canvas 
          ref={canvasRef} 
          style={{ display: 'none' }} 
        />
      </CardContent>
      {!loading && (
        <CardActions>
          <Button startIcon={<DownloadIcon />} onClick={handleDownload}>
            Download
          </Button>
          <Button startIcon={<PrintIcon />} onClick={handlePrint} variant="contained">
            Print Label
          </Button>
        </CardActions>
      )}
    </Card>
  );
};

export default PrintableLabel;
