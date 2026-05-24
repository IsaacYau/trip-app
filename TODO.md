# TODO List for Interactive Travel Scheduler

## Features to Implement
- [x] Add functionality to edit existing activities.
  - **Completed:** Users can now click on an activity to edit its details.
- [x] Implement a feature to delete activities.
  - **Completed:** Users can now delete activities using a delete button.
- [x] Allow users to set reminders for activities.
  - **Completed:** Users can now enable alert notifications for activities with configurable offset times.
- [x] Enhance the UI for better user experience.
  - **Completed:** Built a premium, responsive Single Page Application shell featuring high-fidelity dark/light themes, custom activity modals, and reminder notifications.

## Bugs to Fix
- [x] Fix time conflict detection logic.
  - **Completed:** Implemented mathematical overlap algorithm (`Start1 < End2 AND Start2 < End1`) to alert on overlapping hours.
- [x] Ensure activities are saved correctly in local storage.
  - **Completed:** Refactored persistence layer to store structured JSON arrays instead of fragile innerHTML caching.

## Completed Premium Features
- [x] Implement Subway Graph Node Optimizer (Nagoya, Osaka, Kobe & Kuala Lumpur, Penang) and Didi Ride Estimator (Shenzhen) in Tab 2.
- [x] Implement Nearby Popular Places lookup (Dianping, Tabelog, OpenRice integrations) with GPS Geolocation Distance-ranking in Tab 3.
- [x] Implement Shared Wallet & IC Card Estimator (HKD Ledger with conversions, Suica/Touch 'n Go/Shenzhen Tong skins, greedy debt settling) in Tab 4.
- [x] Implement real-time multi-tab collaborative editing using HTML5 storage sync.

## Future Improvements
- [ ] Add a feature to sync schedules with a calendar service.
- [ ] Implement secure database user authentication (e.g. Supabase/Firebase) for saving schedules.
