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
  iconSize: number
) => {
  const iconData = getHandlingIconData(flag);
  if (!iconData) return;

  // Draw icon border (square)
  ctx.strokeStyle = iconData.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, iconSize, iconSize);

  // Draw icon symbol
  ctx.fillStyle = iconData.color;
  ctx.strokeStyle = iconData.color;

  switch (flag) {
    case 'fragile':
      // Draw wine glass symbol (standard fragile icon)
      ctx.beginPath();
      // Glass bowl
      ctx.moveTo(x + iconSize * 0.35, y + iconSize * 0.25);
      ctx.lineTo(x + iconSize * 0.5, y + iconSize * 0.45);
      ctx.lineTo(x + iconSize * 0.65, y + iconSize * 0.25);
      // Stem
      ctx.moveTo(x + iconSize * 0.5, y + iconSize * 0.45);
      ctx.lineTo(x + iconSize * 0.5, y + iconSize * 0.65);
      // Base
      ctx.moveTo(x + iconSize * 0.4, y + iconSize * 0.65);
      ctx.lineTo(x + iconSize * 0.6, y + iconSize * 0.65);
      ctx.lineWidth = 3;
      ctx.stroke();
      break;

    case 'keep_upright':
      // Draw "This Way Up" arrows (two arrows pointing up)
      ctx.lineWidth = 3;
      // Left arrow
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.3, y + iconSize * 0.5);
      ctx.lineTo(x + iconSize * 0.3, y + iconSize * 0.7);
      ctx.moveTo(x + iconSize * 0.3, y + iconSize * 0.5);
      ctx.lineTo(x + iconSize * 0.25, y + iconSize * 0.55);
      ctx.moveTo(x + iconSize * 0.3, y + iconSize * 0.5);
      ctx.lineTo(x + iconSize * 0.35, y + iconSize * 0.55);
      ctx.stroke();
      // Right arrow
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.7, y + iconSize * 0.5);
      ctx.lineTo(x + iconSize * 0.7, y + iconSize * 0.7);
      ctx.moveTo(x + iconSize * 0.7, y + iconSize * 0.5);
      ctx.lineTo(x + iconSize * 0.65, y + iconSize * 0.55);
      ctx.moveTo(x + iconSize * 0.7, y + iconSize * 0.5);
      ctx.lineTo(x + iconSize * 0.75, y + iconSize * 0.55);
      ctx.stroke();
      // Horizontal line at bottom
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.2, y + iconSize * 0.75);
      ctx.lineTo(x + iconSize * 0.8, y + iconSize * 0.75);
      ctx.stroke();
      break;

    case 'heavy':
      // Draw person lifting box symbol
      ctx.lineWidth = 2;
      // Box
      ctx.strokeRect(x + iconSize * 0.35, y + iconSize * 0.45, iconSize * 0.3, iconSize * 0.25);
      // Person (stick figure)
      ctx.beginPath();
      // Head
      ctx.arc(x + iconSize * 0.3, y + iconSize * 0.35, iconSize * 0.08, 0, Math.PI * 2);
      ctx.stroke();
      // Body
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.3, y + iconSize * 0.43);
      ctx.lineTo(x + iconSize * 0.3, y + iconSize * 0.6);
      // Arms
      ctx.moveTo(x + iconSize * 0.3, y + iconSize * 0.5);
      ctx.lineTo(x + iconSize * 0.35, y + iconSize * 0.5);
      // Legs
      ctx.moveTo(x + iconSize * 0.3, y + iconSize * 0.6);
      ctx.lineTo(x + iconSize * 0.25, y + iconSize * 0.75);
      ctx.moveTo(x + iconSize * 0.3, y + iconSize * 0.6);
      ctx.lineTo(x + iconSize * 0.35, y + iconSize * 0.75);
      ctx.stroke();
      break;

    case 'valuable':
      // Draw "Handle with Care" - hands around box
      ctx.lineWidth = 2;
      // Box in center
      ctx.strokeRect(x + iconSize * 0.35, y + iconSize * 0.35, iconSize * 0.3, iconSize * 0.3);
      // Left hand
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.25, y + iconSize * 0.4);
      ctx.lineTo(x + iconSize * 0.3, y + iconSize * 0.45);
      ctx.lineTo(x + iconSize * 0.3, y + iconSize * 0.55);
      ctx.lineTo(x + iconSize * 0.25, y + iconSize * 0.6);
      ctx.stroke();
      // Right hand
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.75, y + iconSize * 0.4);
      ctx.lineTo(x + iconSize * 0.7, y + iconSize * 0.45);
      ctx.lineTo(x + iconSize * 0.7, y + iconSize * 0.55);
      ctx.lineTo(x + iconSize * 0.75, y + iconSize * 0.6);
      ctx.stroke();
      break;

    case 'priority':
      // Draw caution triangle with exclamation mark
      ctx.lineWidth = 2;
      // Triangle
      ctx.beginPath();
      ctx.moveTo(x + iconSize * 0.5, y + iconSize * 0.2);
      ctx.lineTo(x + iconSize * 0.2, y + iconSize * 0.75);
      ctx.lineTo(x + iconSize * 0.8, y + iconSize * 0.75);
      ctx.closePath();
      ctx.stroke();
      // Exclamation mark
      ctx.fillStyle = iconData.color;
      ctx.fillRect(x + iconSize * 0.47, y + iconSize * 0.35, iconSize * 0.06, iconSize * 0.25);
      ctx.fillRect(x + iconSize * 0.47, y + iconSize * 0.65, iconSize * 0.06, iconSize * 0.06);
      break;

    case 'temperature_sensitive':
      // Draw umbrella with raindrops (keep dry symbol)
      ctx.lineWidth = 2;
      // Umbrella
      ctx.beginPath();
      ctx.arc(x + iconSize * 0.5, y + iconSize * 0.4, iconSize * 0.2, Math.PI, 0, false);
      // Handle
      ctx.moveTo(x + iconSize * 0.5, y + iconSize * 0.4);
      ctx.lineTo(x + iconSize * 0.5, y + iconSize * 0.65);
      ctx.arc(x + iconSize * 0.55, y + iconSize * 0.65, iconSize * 0.05, Math.PI, 0, false);
      ctx.stroke();
      // Raindrops
      ctx.fillStyle = iconData.color;
      ctx.beginPath();
      ctx.arc(x + iconSize * 0.35, y + iconSize * 0.55, iconSize * 0.03, 0, Math.PI * 2);
      ctx.arc(x + iconSize * 0.5, y + iconSize * 0.6, iconSize * 0.03, 0, Math.PI * 2);
      ctx.arc(x + iconSize * 0.65, y + iconSize * 0.55, iconSize * 0.03, 0, Math.PI * 2);
      ctx.fill();
      break;
  }

  // Draw label text below icon
  ctx.font = `bold 9px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = iconData.color;
  ctx.fillText(iconData.label, x + iconSize / 2, y + iconSize + 5);
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

        // Draw handling flag icons at the top if present
        const handlingFlags = container.handlingFlags || [];
        if (handlingFlags.length > 0) {
          const iconSize = 50;
          const iconSpacing = 10;
          const totalIconsWidth = handlingFlags.length * iconSize + (handlingFlags.length - 1) * iconSpacing;
          // Center the icons horizontally
          let currentX = (width - totalIconsWidth) / 2;
          const iconsY = currentY;

          for (const flag of handlingFlags) {
            drawHandlingIcon(ctx, flag, currentX, iconsY, iconSize);
            currentX += iconSize + iconSpacing;
          }

          // Move Y position down past icons and their labels (icon + label text height + spacing)
          currentY += iconSize + 20 + 15; // icon height + label text + spacing
        }

        // Draw horizontal line after icons (if present) or at top
        ctx.beginPath();
        ctx.moveTo(borderPadding + innerPadding, currentY);
        ctx.lineTo(width - borderPadding - innerPadding, currentY);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        currentY += 15; // Space after line

        // Draw "BOX DETAILS" header
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${fontSize + 2}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText('BOX DETAILS', borderPadding + innerPadding, currentY + 15);

        currentY += 30; // Space after header

        // Draw horizontal line after header
        ctx.beginPath();
        ctx.moveTo(borderPadding + innerPadding, currentY);
        ctx.lineTo(width - borderPadding - innerPadding, currentY);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.stroke();

        currentY += 15; // Space after line

        // Draw container name (large, bold)
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${nameFontSize}px Arial`;
        ctx.fillText(container.name, borderPadding + innerPadding, currentY + 15);

        currentY += 40; // Space after name

        // Draw container type
        ctx.fillStyle = '#333333';
        ctx.font = `${fontSize}px Arial`;
        const containerType = container.type.charAt(0).toUpperCase() + container.type.slice(1);
        ctx.fillText(`Type: ${containerType}`, borderPadding + innerPadding, currentY);

        currentY += 25; // Space after type

        // Draw contents summary if available
        if (container.contentsSummary) {
          ctx.fillStyle = '#333333';
          ctx.font = `${fontSize - 2}px Arial`;
          const summary = container.contentsSummary.substring(0, 40);
          ctx.fillText(summary, borderPadding + innerPadding, currentY);
          currentY += 25; // Space after summary
        }

        console.log('PrintableLabel: Starting QR code generation with ID:', qrCodeId);

        // Generate and draw QR code
        const qrCodeDataUrl = await QRCode.toDataURL(qrCodeId, {
          width: qrSize,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
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

        // Draw container ID underneath QR code
        const containerId = container.id.substring(0, 16) + '...';
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${fontSize - 2}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(containerId, width / 2, qrY + qrSize + 20);

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
  }, [container, qrCodeId, size]);

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
                style={{ maxWidth: '100%', height: 'auto', border: '1px solid #ddd' }} 
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
