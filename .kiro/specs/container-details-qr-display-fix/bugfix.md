# Bugfix Requirements Document

## Introduction

The container details page does not correctly implement the QR code display and label generation requirements from the qr-code-container-assignment specification. This bug affects the user experience by requiring manual QR code generation when codes should already exist, displaying incorrect UI elements, and generating labels that don't match the specified format.

The bug impacts Requirements 1.1, 1.7, and 5 from the original specification, which state that QR codes should be automatically generated during container creation, displayed on the container details page, and that labels should follow a specific layout with appropriate content.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a container with an existing QR code is displayed on the details page THEN the system shows only the text "QR Code" instead of displaying the actual QR code image

1.2 WHEN a container with an existing QR code is displayed on the details page THEN the system shows a "Generate QR Code" button even though the QR code already exists

1.3 The "Print Label" button displays a QR code icon instead of a printer icon

1.4 WHEN the QRCodeGenerator dialog opens THEN the system shows a "QR Code Size" selection dropdown even though the QR code was already generated at container creation time

1.5 WHEN the QRCodeGenerator dialog opens THEN the system shows a "Generate QR Code" button even though the QR code already exists

1.6 WHEN the user generates a label THEN the system produces a label that does not match the requirements specification layout (missing proper handling flag icons, incorrect layout structure)

### Expected Behavior (Correct)

2.1 WHEN a container with an existing QR code is displayed on the details page THEN the system SHALL display the actual QR code image (120x120 pixels) in the Statistics card

2.2 WHEN a container with an existing QR code is displayed on the details page THEN the system SHALL show only a "Print Label" button without any "Generate QR Code" button. The current large button should not be present and the only print label button should be on the menu bar at the top right of the form

2.3 WHEN the user clicks the "Print Label" button THEN the system SHALL display a printer icon (PrintIcon) instead of a QR code icon

2.4 WHEN the QRCodeGenerator dialog opens for a container with an existing QR code THEN the system SHALL NOT show the "QR Code Size" selection dropdown

2.5 WHEN the QRCodeGenerator dialog opens for a container with an existing QR code THEN the system SHALL NOT show the "Generate QR Code" button

2.6 WHEN the user generates a label THEN the system SHALL produce a label that matches the requirements specification including: QR code, container name in large print, container type, appropriate handling flag icons and text (e.g., Fragile icon for fragile containers, Keep Upright icon for keep_upright), and A5 label dimensions as specified in the design

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a container does not have a QR code (legacy containers or QR generation failed) THEN the system SHALL CONTINUE TO show the "Generate QR Code" button to allow manual generation

3.2 WHEN the user clicks "Print Label" THEN the system SHALL CONTINUE TO open the QRCodeGenerator dialog

3.3 WHEN the QRCodeGenerator dialog is open THEN the system SHALL CONTINUE TO display container information (name, type, items, status)

3.4 WHEN a label is generated THEN the system SHALL CONTINUE TO provide download and print functionality

3.5 WHEN the user closes the QRCodeGenerator dialog THEN the system SHALL CONTINUE TO refresh the container data to reflect any changes

3.6 WHEN a QR code image is loading THEN the system SHALL CONTINUE TO show a loading indicator

3.7 WHEN a QR code image fails to load THEN the system SHALL CONTINUE TO handle the error gracefully
