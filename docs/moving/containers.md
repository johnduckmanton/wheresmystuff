# Containers

Containers represent the physical boxes, bags, and crates you use to pack and move your things. Each container tracks what's inside, where it is, and what state it's in.

## Creating a Container

1. Navigate to **Containers** in the sidebar (under Moving & Storage).
2. Click **Add Container**.
3. Enter a **name** (e.g., "Kitchen Box 1", "Fragile Items", "Winter Clothes").
4. Select a **type**:

| Type | Description |
|---|---|
| Box | Standard cardboard or moving box |
| Bag | Duffel bag, garbage bag, or similar |
| Crate | Wooden or plastic crate |
| Bin | Plastic storage bin or tote |
| Suitcase | Travel suitcase or luggage |
| Trunk | Storage trunk or chest |

5. Optionally set:
    - **Size** — Small, Medium, Large, or Custom
    - **Color** — A visual identifier for the container
    - **Weight** — Estimated weight in kg
    - **Description** — Additional notes
    - **Contents summary** — A brief description of what's inside (up to 200 characters)
    - **Location** and **Room** — Where the container currently is
    - **Target location** and **Target room** — Where it's going
    - **Handling flags** — Special handling requirements (see below)
    - **Project** — Assign to a moving project
6. Click **Save**.

## Handling Flags

Handling flags alert anyone moving the container to special requirements:

| Flag | Meaning |
|---|---|
| Fragile | Contains breakable items — handle with care |
| Heavy | Heavier than average — may need two people |
| Valuable | Contains high-value items |
| Priority | Should be unpacked first |
| Keep Upright | Must stay upright during transport |
| Temperature Sensitive | Contents are sensitive to heat or cold |

You can assign multiple flags to a single container.

## Container Status Workflow

Every container moves through a lifecycle of statuses:

```
Empty → Packing → Packed → In Transit → Stored → Unpacking → Unpacked
```

| Status | Meaning |
|---|---|
| **Empty** | Container exists but nothing is packed in it yet |
| **Packing** | You're actively adding items to this container |
| **Packed** | Container is sealed and ready to go |
| **In Transit** | Container is being transported |
| **Stored** | Container is in storage (temporary or long-term) |
| **Unpacking** | You're actively removing items from this container |
| **Unpacked** | All items have been removed and placed at their new location |

!!! note
    Not every container needs to go through every status. For example, a container might go directly from Packed to Unpacking if there's no transit or storage involved.

To update a container's status:

1. Open the container.
2. Change the **Status** field to the next appropriate status.
3. Click **Save**.

## Packing Items into Containers

1. Open the container you want to pack items into.
2. Click **Add Items** or **Pack Items**.
3. Select things from your inventory to add to the container.
4. The selected items are now associated with this container.

When an item is packed into a container, it appears in the container's item list and the item's detail view shows which container it's in.

!!! tip
    The container automatically tracks the **item count** and **estimated value** based on the items packed inside.

## Container Photos

You can add photos to containers to document their contents or condition.

1. Open the container.
2. In the photos section, click **Add Photo** or drag and drop an image.
3. Photos are stored securely and visible to anyone with access to the inventory.

## Unpacking

When you unpack a container at its destination, the app can update item locations automatically.

1. Open the container.
2. Change the status to **Unpacking**.
3. As you remove items, you can update their location to the container's current location (or choose a different one).
4. When all items are removed, change the status to **Unpacked**.

!!! tip
    If the container has a **target location** and **target room** set, the app can use those as the default new location for unpacked items.

## Moving Containers Between Locations

To update where a container is:

1. Open the container.
2. Change the **Location** and/or **Room** fields.
3. Click **Save**.

This is useful when containers are physically moved to a new location, such as from your home to a moving truck, or from a truck to a storage unit.

## QR Codes for Containers

Every container gets a unique QR code. See [QR Codes](qr-codes.md) for details on generating, printing, and scanning QR codes.
