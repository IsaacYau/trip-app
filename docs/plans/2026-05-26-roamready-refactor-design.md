# RoamReady Travel App Refactoring Design

## Goal Description
Improve the user authentication and network creation/joining flows in the RoamReady mobile web app. This includes securing group entry with passwords, fixing refresh-based onboarding bugs, preventing page freezes, syncing the active group dropdown, and isolating group schedule data into distinct localStorage and database partitions.

---

## Architectural & UI Redesign Details

### 1. Unified Access & Onboarding Popup (Auth Modal)
We will redesign the existing `auth-modal` popup into a gorgeous, 3-tabbed premium layout:
- **Tab 1: Enter Existing Group**: Allows entering their name, a group/trip code, and a password if required.
- **Tab 2: Create New Group**: Allows creating a new group by choosing a unique group name/code, a password, and a public/private toggle.
- **Tab 3: Browse Networks**: A dynamic, scrollable list of all registered groups in Firestore. 
  - **Public groups** will be badged `Public` in green and can be joined instantly without a password.
  - **Private groups** will be badged `Private` with a lock icon and will prompt for a password when clicked.

### 2. Immediate Toast Feedback & Login/Logout Flow
- **Automatic popup on login**: After successful Google Sign-in, a toast is shown (*"Logged in successfully!"*) and the Access RoamReady popup immediately opens with their name pre-filled from their Google account.
- **Persistent sign-in**: If a user is signed in but has not chosen/entered a group, we prompt them immediately to do so without requiring a browser refresh.

### 3. Local Storage & Database Partitioning
- To ensure schedule data is saved distinctly and does not bleed across groups, localStorage keys will be fully group-specific:
  - `travelActivities_[groupId]`
  - `travelExpenses_[groupId]`
  - `travelICCards_[groupId]`
- When switching to a new group, we load that group's specific partitioned keys.
- **Default for new groups**: When a new group is created, it starts with an empty activities list (`[]`) and empty expenses (`[]`), ensuring no leak of other groups' data or global mock data.

### 4. Active Group Select Dropdown Sync
- Switching groups in the header dropdown (`active-group-select`) immediately triggers a partitioned database reload and switches real-time listeners.
- Newly entered or created group codes are immediately added as options in the dropdown and set as active.
- To prevent UI freezing, we ensure all Firestore actions are fully asynchronous (`async/await`) and handle loading, completion, and error states gracefully.

---

## Verification Plan

### Automated Tests
- Running the `node test.js` suite to ensure no regressions in Dijkstra transit engine, currency math, or other core utils.
- Testing unit behavior of state partitioning.

### Manual Verification
- Testing user registration and Google Login.
- Verifying the new 3-tab modal layout on mobile screen sizes.
- Testing group creation (public and private).
- Verifying password rejection on private groups.
- Swapping between groups and confirming that schedules remain independent.
