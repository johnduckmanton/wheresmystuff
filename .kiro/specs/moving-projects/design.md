# Moving Projects Design Document

## Overview

The Moving Projects system provides comprehensive project management for house moves, integrating with the existing container and inventory management system. The design focuses on simplicity and practicality, providing essential project tracking without overwhelming complexity.

The system manages the complete moving workflow from initial planning through completion, with milestone tracking, task management, and basic budget oversight. Projects serve as the organizing principle for moves, connecting containers, items, timelines, and logistics in a cohesive experience.

## Architecture

### System Integration

```
┌─────────────────────────────────────────────────────────────┐
│                    Moving Projects Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Project Dashboard │  Timeline View  │  Task Management    │
│  Budget Tracking   │  Milestone Mgmt │  Sharing System     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Existing Container System                    │
├─────────────────────────────────────────────────────────────┤
│  Container CRUD    │  QR Codes       │  Packing Interface  │
│  Item Management   │  Photo Storage  │  Location Tracking  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 Core Inventory System                        │
├─────────────────────────────────────────────────────────────┤
│  Things, Locations, Rooms, Categories, People              │
│  Authentication, Storage, API Gateway                       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Project Creation**: User creates project with basic details and timeline
2. **Container Assignment**: Existing containers can be assigned to projects
3. **Item Assignment**: Individual items can be assigned to projects independently of containers
4. **Milestone Tracking**: Timeline management with custom and default milestones
5. **Task Management**: Checklist functionality with default and custom tasks
6. **Budget Tracking**: Simple expense tracking with categories
7. **Progress Monitoring**: Visual indicators and completion tracking
8. **Sharing**: Read-only project sharing with external parties

## Components and Interfaces

### Frontend Components

#### 1. Project Dashboard Component
```typescript
interface ProjectDashboardProps {
  projects: MovingProject[];
  onCreateProject: () => void;
  onProjectSelect: (project: MovingProject) => void;
  filter: 'active' | 'completed' | 'archived' | 'all';
}

// Features:
// - Project cards with status indicators
// - Quick stats (active projects, upcoming milestones)
// - Filter controls
// - Create new project button
```

#### 2. Project Detail Component
```typescript
interface ProjectDetailProps {
  project: MovingProject;
  onUpdate: (updates: Partial<MovingProject>) => void;
  onDelete: () => void;
}

// Features:
// - Project header with status and dates
// - Timeline view
// - Task list
// - Budget summary
// - Container assignments
// - Notes section
```

#### 3. Project Form Dialog Component
```typescript
interface ProjectFormDialogProps {
  open: boolean;
  project?: MovingProject | null;
  locations: Location[];
  onClose: () => void;
  onSave: (project: MovingProject) => void;
}

// Features:
// - Basic project details form
// - Location selectors (from/to)
// - Date pickers
// - Status selector
// - Notes text area
```

#### 4. Timeline Component
```typescript
interface TimelineProps {
  project: MovingProject;
  milestones: Milestone[];
  onMilestoneAdd: (milestone: Milestone) => void;
  onMilestoneUpdate: (milestone: Milestone) => void;
  onMilestoneDelete: (milestoneId: string) => void;
}

// Features:
// - Visual timeline with milestones
// - Current date indicator
// - Overdue milestone highlighting
// - Add/edit milestone functionality
// - Responsive design for mobile
```

#### 5. Task Management Component
```typescript
interface TaskManagementProps {
  project: MovingProject;
  tasks: ProjectTask[];
  onTaskAdd: (task: ProjectTask) => void;
  onTaskUpdate: (task: ProjectTask) => void;
  onTaskDelete: (taskId: string) => void;
}

// Features:
// - Task list with checkboxes
// - Add custom tasks
// - Filter by completed/pending
// - Task completion timestamps
// - Progress indicator
```

#### 6. Budget Tracking Component
```typescript
interface BudgetTrackingProps {
  project: MovingProject;
  budgetItems: BudgetItem[];
  onBudgetItemAdd: (item: BudgetItem) => void;
  onBudgetItemUpdate: (item: BudgetItem) => void;
  onBudgetItemDelete: (itemId: string) => void;
}

// Features:
// - Budget item list with categories
// - Total cost calculation
// - Paid/unpaid status tracking
// - Category-based grouping
// - Budget limit warnings
```

#### 7. Project Sharing Component
```typescript
interface ProjectSharingProps {
  project: MovingProject;
  onGenerateLink: (expirationDays: number) => Promise<string>;
  onRevokeLink: (linkId: string) => void;
  existingLinks: ShareLink[];
}

// Features:
// - Generate shareable links
// - Set expiration dates
// - View existing shares
// - Revoke access
// - Access log display
```

#### 8. Project Assignment Dialog Component
```typescript
interface ProjectAssignmentDialogProps {
  open: boolean;
  project: MovingProject;
  inventoryId: string;
  onClose: () => void;
  onAssignmentChange: () => void;
}

// Features:
// - Tabbed interface with three tabs: Containers, Things, Assigned
// - Containers tab: Search and filter available containers
// - Things tab: Search and filter available individual things (by name, category, location)
// - Assigned tab: View all assigned containers and things with bulk removal options
// - Bulk assignment/removal operations
// - Thing status indicators (loose vs containerized)
// - Assignment conflict warnings
// - Real-time count updates
// - Similar UX to PackingInterface but for project assignment
```

### Backend Services

#### 1. Moving Project Service
```javascript
class MovingProjectService {
  async createProject(inventoryId, projectData);
  async getProject(projectId);
  async updateProject(projectId, updates);
  async deleteProject(projectId);
  async listProjects(inventoryId, filter);
  async archiveProject(projectId);
  async getProjectStats(inventoryId);
}
```

#### 2. Milestone Service
```javascript
class MilestoneService {
  async createMilestone(projectId, milestoneData);
  async updateMilestone(milestoneId, updates);
  async deleteMilestone(milestoneId);
  async listMilestones(projectId);
  async getOverdueMilestones(inventoryId);
}
```

#### 3. Task Service
```javascript
class TaskService {
  async createTask(projectId, taskData);
  async updateTask(taskId, updates);
  async deleteTask(taskId);
  async listTasks(projectId, filter);
  async getDefaultTasks(); // Common moving tasks
  async markTaskComplete(taskId);
}
```

#### 4. Budget Service
```javascript
class BudgetService {
  async createBudgetItem(projectId, itemData);
  async updateBudgetItem(itemId, updates);
  async deleteBudgetItem(itemId);
  async listBudgetItems(projectId);
  async getBudgetSummary(projectId);
  async markItemPaid(itemId);
}
```

#### 5. Project Sharing Service
```javascript
class ProjectSharingService {
  async generateShareLink(projectId, expirationDays);
  async getSharedProject(shareId);
  async revokeShareLink(linkId);
  async listShareLinks(projectId);
  async logShareAccess(shareId, accessInfo);
}
```

#### 6. Project Assignment Service
```javascript
class ProjectAssignmentService {
  // Container assignment
  async assignContainersToProject(projectId, containerIds, inventoryId);
  async removeContainersFromProject(projectId, containerIds, inventoryId);
  
  // Thing assignment
  async assignThingsToProject(projectId, thingIds, inventoryId);
  async removeThingsFromProject(projectId, thingIds, inventoryId);
  
  // Bulk operations
  async bulkAssignContainers(projectId, containerIds, inventoryId);
  async bulkAssignThings(projectId, thingIds, inventoryId);
  
  // Queries
  async getProjectContainers(projectId, inventoryId);
  async getProjectThings(projectId, inventoryId);
  async getAvailableContainers(inventoryId, excludeProjectId);
  async getAvailableThings(inventoryId, excludeProjectId);
  async getAssignmentStatus(containerId, thingId, inventoryId);
}
```

## Data Models

### Moving Project Entity

```typescript
interface MovingProject {
  id: string;                    // UUID
  inventoryId: string;           // Reference to inventory
  name: string;                  // Project name
  description?: string;          // Optional description
  status: ProjectStatus;         // Current project phase
  fromLocationId?: string;       // Origin location UUID
  toLocationId?: string;         // Destination location UUID
  startDate: string;             // ISO timestamp
  endDate?: string;              // Optional planned end date
  completionDate?: string;       // Actual completion date
  notes?: string;                // Removal company details, etc.
  budgetLimit?: number;          // Optional budget limit
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  createdBy: string;             // User ID
  archivedAt?: string;           // Archive timestamp
  metadata: Record<string, any>; // Extensible metadata
}

enum ProjectStatus {
  Planning = 'planning',
  Packing = 'packing',
  Moving = 'moving',
  Complete = 'complete',
  Archived = 'archived'
}
```

### Milestone Entity

```typescript
interface Milestone {
  id: string;                    // UUID
  projectId: string;             // Project reference
  name: string;                  // Milestone name
  type: MilestoneType;           // Milestone category
  date: string;                  // ISO date
  description?: string;          // Optional details
  completed: boolean;            // Completion status
  completedAt?: string;          // Completion timestamp
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

enum MilestoneType {
  StartDate = 'start_date',
  MovingOutDate = 'moving_out_date',
  MovingInDate = 'moving_in_date',
  Custom = 'custom'
}
```

### Project Task Entity

```typescript
interface ProjectTask {
  id: string;                    // UUID
  projectId: string;             // Project reference
  name: string;                  // Task name
  description?: string;          // Task details
  category: TaskCategory;        // Task grouping
  completed: boolean;            // Completion status
  completedAt?: string;          // Completion timestamp
  dueDate?: string;              // Optional due date
  priority: TaskPriority;        // Task importance
  isDefault: boolean;            // System-provided task
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

enum TaskCategory {
  PreMove = 'pre_move',
  Packing = 'packing',
  Moving = 'moving',
  PostMove = 'post_move',
  Custom = 'custom'
}

enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high'
}
```

### Budget Item Entity

```typescript
interface BudgetItem {
  id: string;                    // UUID
  projectId: string;             // Project reference
  description: string;           // Item description
  amount: number;                // Cost amount
  category: BudgetCategory;      // Expense category
  paid: boolean;                 // Payment status
  paidAt?: string;               // Payment timestamp
  dueDate?: string;              // Optional due date
  notes?: string;                // Additional details
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}

enum BudgetCategory {
  RemovalCompany = 'removal_company',
  Storage = 'storage',
  PackingMaterials = 'packing_materials',
  Insurance = 'insurance',
  Utilities = 'utilities',
  Other = 'other'
}
```

### Share Link Entity

```typescript
interface ShareLink {
  id: string;                    // UUID
  projectId: string;             // Project reference
  shareId: string;               // Public share identifier
  expiresAt: string;             // Expiration timestamp
  accessCount: number;           // Number of accesses
  lastAccessedAt?: string;       // Last access timestamp
  createdAt: string;             // ISO timestamp
  createdBy: string;             // User ID
  revoked: boolean;              // Revocation status
  revokedAt?: string;            // Revocation timestamp
}
```

### DynamoDB Single Table Design

```
PK                          SK                          EntityType    Attributes
─────────────────────────────────────────────────────────────────────────────────
INV#{inventoryId}          PROJECT#{projectId}         Project       {...}
PROJECT#{projectId}        MILESTONE#{milestoneId}     Milestone     {...}
PROJECT#{projectId}        TASK#{taskId}               Task          {...}
PROJECT#{projectId}        BUDGET#{budgetItemId}       BudgetItem    {...}
PROJECT#{projectId}        ITEM#{itemId}               ItemAssignment{...}
SHARE#{shareId}            PROJECT#{projectId}         ShareLink     {...}
USER#{userId}              PROJECT#{projectId}         UserProject   {...}
```

### Item Assignment Entity

```typescript
interface ThingAssignment {
  id: string;                    // UUID
  projectId: string;             // Project reference
  thingId: string;               // Thing reference
  inventoryId: string;           // Inventory reference
  assignedAt: string;            // ISO timestamp
  unassignedAt?: string;         // ISO timestamp (null if currently assigned)
  containerizedAt?: string;      // ISO timestamp when thing was packed into container (null if loose)
  containerizedContainerId?: string; // Container ID if thing was packed (null if loose/not containerized)
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
}
```

Note: Things do NOT have a project field. Assignments are stored as separate entities in the project's thing assignment records. This allows:
- **Loose things** (wardrobes, beds, furniture) to be assigned directly to projects without containers
- **Containerized things** to maintain their project assignment even after being packed
- **Flexible reassignment** - things can be moved between projects or unassigned at any time
- **Historical tracking** - assignment history is preserved for reference

### GSI Indexes

1. **ProjectStatusIndex**: Query projects by status
   - PK: `STATUS#{status}`
   - SK: `PROJECT#{projectId}`

2. **MilestoneDateIndex**: Query milestones by date
   - PK: `DATE#{date}`
   - SK: `MILESTONE#{milestoneId}`

3. **ShareLinkIndex**: Fast share link lookup
   - PK: `SHARE#{shareId}`
   - SK: `PROJECT#{projectId}`

4. **ItemAssignmentIndex**: Query items assigned to a project
   - PK: `PROJECT#{projectId}`
   - SK: `ITEM#{itemId}`

5. **ItemProjectIndex**: Query all projects an item is assigned to
   - PK: `ITEM#{itemId}`
   - SK: `PROJECT#{projectId}`

## API Endpoints

### Project Management

```
POST   /projects
GET    /projects
GET    /projects/{id}
PUT    /projects/{id}
DELETE /projects/{id}
POST   /projects/{id}/archive
GET    /projects/stats
```

### Milestone Management

```
POST   /projects/{id}/milestones
GET    /projects/{id}/milestones
PUT    /milestones/{id}
DELETE /milestones/{id}
GET    /milestones/overdue
```

### Task Management

```
POST   /projects/{id}/tasks
GET    /projects/{id}/tasks
PUT    /tasks/{id}
DELETE /tasks/{id}
POST   /tasks/{id}/complete
GET    /tasks/defaults
```

### Budget Management

```
POST   /projects/{id}/budget
GET    /projects/{id}/budget
PUT    /budget/{id}
DELETE /budget/{id}
POST   /budget/{id}/pay
GET    /projects/{id}/budget/summary
```

### Project Sharing

```
POST   /projects/{id}/share
GET    /projects/{id}/shares
DELETE /shares/{id}
GET    /shared/{shareId}
```

### Project Assignment

```
POST   /projects/{id}/containers
DELETE /projects/{id}/containers/{containerId}
GET    /projects/{id}/containers
POST   /projects/{id}/containers/bulk

POST   /projects/{id}/things
DELETE /projects/{id}/things/{thingId}
GET    /projects/{id}/things
POST   /projects/{id}/things/bulk

GET    /inventories/{inventoryId}/containers/available
GET    /inventories/{inventoryId}/things/available
GET    /containers/{id}/projects
GET    /things/{id}/projects
```

## User Interface Design

### Project Dashboard

- **Card Layout**: Projects displayed as cards with key information
- **Status Indicators**: Color-coded status badges
- **Quick Stats**: Active projects, upcoming milestones, overdue items
- **Filter Controls**: Active/Completed/Archived/All
- **Search**: Find projects by name or location

### Project Detail View

- **Header Section**: Project name, status, dates, locations
- **Tab Navigation**: Timeline, Tasks, Budget, Containers, Notes
- **Action Buttons**: Edit, Share, Archive, Delete
- **Progress Indicators**: Visual completion status

### Timeline View

- **Horizontal Timeline**: Chronological milestone display
- **Current Date Marker**: Visual indicator of today
- **Milestone Cards**: Expandable details for each milestone
- **Add Milestone**: Quick-add functionality
- **Overdue Highlighting**: Visual warnings for missed dates

### Task Management

- **Checklist Interface**: Standard checkbox list
- **Category Grouping**: Tasks organized by phase
- **Progress Bar**: Overall completion percentage
- **Add Task**: Simple form for custom tasks
- **Filter Options**: Show all/completed/pending

### Budget Tracking

- **Item List**: Description, amount, category, status
- **Category Totals**: Subtotals by expense type
- **Grand Total**: Overall project cost
- **Payment Status**: Paid/unpaid indicators
- **Budget Limit**: Warning when approaching limit

## Mobile Considerations

### Responsive Design

- **Mobile-First**: Optimized for phone screens
- **Touch Targets**: Minimum 44px touch areas
- **Swipe Gestures**: Navigate between project sections
- **Collapsible Sections**: Expandable content areas

### Offline Support

- **Local Storage**: Cache project data for offline viewing
- **Sync on Reconnect**: Update server when connection restored
- **Offline Indicators**: Show when data is stale

## Testing Strategy

### Unit Tests

1. **Project Service Tests**: CRUD operations, validation
2. **Milestone Management**: Date calculations, overdue detection
3. **Task Management**: Completion tracking, default tasks
4. **Budget Calculations**: Totals, category summaries
5. **Sharing Service**: Link generation, access control

### Integration Tests

1. **Project Workflow**: Complete project lifecycle
2. **Container Integration**: Project-container relationships
3. **Timeline Management**: Milestone and date handling
4. **Sharing System**: Link generation and access

### Property-Based Tests

1. **Date Validation**: Milestone and project date consistency
2. **Budget Calculations**: Mathematical accuracy across scenarios
3. **Status Transitions**: Valid project status changes
4. **Task Completion**: Progress calculation accuracy

## Security Considerations

### Access Control

- **Project Ownership**: Users can only access their projects
- **Share Link Security**: Time-limited, revocable access
- **Data Privacy**: Sensitive information excluded from shares
- **Audit Logging**: Track all project modifications

### Data Protection

- **Input Validation**: Sanitize all user inputs
- **SQL Injection Prevention**: Parameterized queries
- **XSS Protection**: Escape output data
- **CSRF Protection**: Token-based request validation

## Performance Optimization

### Caching Strategy

- **Project Lists**: Cache frequently accessed project data
- **Timeline Data**: Cache milestone calculations
- **Task Templates**: Cache default task lists
- **Budget Summaries**: Cache calculated totals

### Database Optimization

- **Efficient Queries**: Use GSI indexes for common queries
- **Batch Operations**: Group related database operations
- **Pagination**: Limit result sets for large projects
- **Lazy Loading**: Load detailed data on demand

## Future Enhancements

1. **Integration APIs**: Connect with moving company systems
2. **Mobile App**: Dedicated mobile application
3. **Notification System**: Email/SMS reminders for milestones
4. **Document Storage**: Attach contracts, receipts, photos
5. **Collaboration Features**: Multi-user project management
6. **Advanced Reporting**: Detailed project analytics
7. **Template System**: Reusable project templates
8. **Calendar Integration**: Sync with external calendars