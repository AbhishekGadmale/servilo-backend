# Graph Report - servilo  (2026-04-25)

## Corpus Check
- 80 files · ~103,996 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 229 nodes · 230 edges · 10 communities detected
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 12 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 7 edges
2. `g()` - 6 edges
3. `getNthColumn()` - 6 edges
4. `enableUI()` - 6 edges
5. `getItemKey()` - 5 edges
6. `makeCurrent()` - 5 edges
7. `Q()` - 5 edges
8. `D()` - 5 edges
9. `y()` - 5 edges
10. `getTableHeader()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `AppNavigator()` --calls--> `useAuth()`  [INFERRED]
  mobile\src\navigation\AppNavigator.js → mobile\src\context\AuthContext.js
- `LoginScreen()` --calls--> `useAuth()`  [INFERRED]
  mobile\src\screens\auth\LoginScreen.js → mobile\src\context\AuthContext.js
- `SignupScreen()` --calls--> `useAuth()`  [INFERRED]
  mobile\src\screens\auth\SignupScreen.js → mobile\src\context\AuthContext.js
- `ProfileScreen()` --calls--> `useAuth()`  [INFERRED]
  mobile\src\screens\customer\ProfileScreen.js → mobile\src\context\AuthContext.js
- `MyBookingsScreen()` --calls--> `useNetworkToast()`  [INFERRED]
  mobile\src\screens\customer\MyBookingsScreen.js → mobile\src\hooks\useNetworkToast.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.09
Nodes (10): AppNavigator(), useAuth(), HomeScreen(), LoginScreen(), MyBookingsScreen(), ProfileScreen(), ProviderDashboardScreen(), ShopListScreen() (+2 more)

### Community 2 - "Community 2"
Cohesion: 0.36
Nodes (13): addSearchBox(), addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns() (+5 more)

### Community 3 - "Community 3"
Cohesion: 0.44
Nodes (10): a(), B(), c(), D(), g(), i(), k(), o() (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.33
Nodes (8): cancelBooking(), createBooking(), markArrived(), notifyProvider(), notifyQueuePositions(), notifyUser(), sendPushNotification(), updateBookingStatus()

### Community 6 - "Community 6"
Cohesion: 0.25
Nodes (2): App(), ErrorBoundary

### Community 7 - "Community 7"
Cohesion: 0.25
Nodes (1): loginAPI()

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (3): updateProfileAPI(), setupPushNotifications(), registerForPushNotifications()

### Community 9 - "Community 9"
Cohesion: 0.38
Nodes (3): generateToken(), login(), signup()

### Community 10 - "Community 10"
Cohesion: 0.57
Nodes (6): addItem(), buildItem(), deleteItem(), getItemKey(), getItems(), updateItem()

### Community 11 - "Community 11"
Cohesion: 0.73
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

## Knowledge Gaps
- **Thin community `Community 6`** (8 nodes): `App.js`, `App()`, `AppWithNotifications()`, `ErrorBoundary`, `.componentDidCatch()`, `.getDerivedStateFromError()`, `.render()`, `App.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (8 nodes): `api.js`, `approveShopAPI()`, `deleteShopAPI()`, `deleteUserAPI()`, `getAllShopsAdminAPI()`, `getAllUsersAPI()`, `getStatsAPI()`, `loginAPI()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Community 0` to `Community 8`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `updateProfileAPI()` connect `Community 8` to `Community 1`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `useAuth()` (e.g. with `AppNavigator()` and `LoginScreen()`) actually correct?**
  _`useAuth()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.09 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._