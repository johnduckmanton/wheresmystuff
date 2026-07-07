# Bugfix Requirements Document

## Introduction

This document covers two small UI/UX bugs in the WheresMyStuff home inventory application:

1. **Lists not sorted by most recently created first** — Entity lists (Things, Containers, Locations, People, Categories) do not default to showing the most recently created items first, making it hard for users to find items they just added.

2. **No way to delete photos in mobile interface** — The mobile Thing detail view (`ThingDetailSheet`) displays photos but provides no mechanism to delete them. Users on mobile devices are stuck with photos they want to remove.

3. **Success notification does not link to newly created item** — When a user creates a new Thing, Container, Location, Person, or Category, the success notification/toast does not provide a clickable link to navigate to the newly created item. Users must manually find the item in the list to continue working with it.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user views the Things list page THEN the system displays things in arbitrary order (DynamoDB partition key order) rather than most recently created first

1.2 WHEN a user views the Containers list page THEN the system displays containers without a default sort by creation date

1.3 WHEN a user views other entity list pages (Locations, People, Categories) THEN the system displays items without a default sort by most recently created first

1.4 WHEN a user views a Thing's photos in the mobile detail sheet (ThingDetailSheet) THEN the system provides no option to delete a photo

1.5 WHEN a user wants to remove a photo from a Thing on a mobile device THEN the system offers no delete button or gesture to accomplish this

1.6 WHEN a user creates a new Thing, Container, Location, Person, or Category THEN the success notification displays a plain text message with no link to the newly created item

1.7 WHEN a user wants to immediately navigate to a just-created item THEN the system provides no shortcut; the user must manually find the item in the list

### Expected Behavior (Correct)

2.1 WHEN a user views the Things list page THEN the system SHALL display things sorted by creation date (dateAdded) in descending order (most recent first) by default

2.2 WHEN a user views the Containers list page THEN the system SHALL display containers sorted by creation date (createdAt) in descending order (most recent first) by default

2.3 WHEN a user views other entity list pages (Locations, People, Categories) THEN the system SHALL display items sorted by creation date (dateAdded) in descending order by default

2.4 WHEN a user views a Thing's photos in the mobile detail sheet THEN the system SHALL display a delete button or action for each photo

2.5 WHEN a user taps the photo delete action in the mobile detail sheet THEN the system SHALL confirm the deletion and remove the photo from both S3 storage and the Thing's photo array

2.6 WHEN a user creates a new Thing, Container, Location, Person, or Category THEN the success notification SHALL include a clickable link that navigates to the newly created item's detail page

2.7 WHEN a user clicks the link in the creation success notification THEN the system SHALL navigate to the detail/edit page for the newly created item

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user explicitly sorts a list by a different column (e.g., name, category) THEN the system SHALL CONTINUE TO respect the user's chosen sort order

3.2 WHEN a user applies filters or search to a list THEN the system SHALL CONTINUE TO return filtered results (now sorted by creation date by default within the filter)

3.3 WHEN a user uploads a new photo to a Thing on desktop THEN the system SHALL CONTINUE TO add the photo and display it correctly

3.4 WHEN a user deletes a photo using the existing ContainerPhotoUpload component (desktop) THEN the system SHALL CONTINUE TO delete photos successfully via the existing flow

3.5 WHEN a user views the Home page dashboard with recent items THEN the system SHALL CONTINUE TO show the top 3 most recent things and containers as it already does

3.6 WHEN a user creates a new item THEN the system SHALL CONTINUE TO store the creation timestamp (dateAdded/createdAt) correctly

3.7 WHEN a user dismisses the creation success notification without clicking the link THEN the system SHALL CONTINUE TO function normally without navigating away from the current page
