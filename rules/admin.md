# Admin Frontend Rules

## Stack and Routing

- The desktop admin uses React, TypeScript, Vite, and React Router. `src/app/router` centrally owns routing.
- Desktop styles use Tailwind CSS and semantic theme tokens. Create product UI primitives as features need them after approved Figma designs exist; do not preinstall another styling or component system.
- `src/app/` owns bootstrap, routing, and providers. Do not distribute route definitions across features.
- `src/views/` contains route-level pages that compose layouts, features, and page state; they do not call the generated API client directly.
- `src/layouts/` owns the application shell, navigation, header, and content area, not room, report, or user domain rules.

## Feature Ownership

- Organize the admin into business features such as `auth`, `dashboard`, `rooms`, `moderation`, `users`, and `settings`.
- Table columns, filters, business forms, detail panels, and permission actions belong to their feature, not root `components/`.
- Root `components/` contains only cross-feature primitives such as Button, Input, Modal, Table shell, and EmptyState.
- Expose only the components, hooks, and types needed for route composition. Do not import other features' internals.

## Data-heavy States

- Lists define applicable filtering, pagination, sorting, loading, empty, error, permission-denied, and refresh behavior.
- Destructive or privileged operations require confirmation and must display the final server result.
- Frontend permission checks improve usability; the server must authorize again. Hidden buttons are not a security boundary.
- Server state uses the unified query cache. Do not place form or transient UI state in a global store without a reason.

## Visual and Responsive Behavior

- Approved Figma frames, component states, and viewports establish the visual target.
- Support at least the desktop widths specified by Architecture. Do not promise full mobile adaptation without design confirmation.
- Tables, dialogs, drawers, dropdowns, and toasts cover keyboard focus, dismissal, scrolling, and error states.

## Testing

- Use Playwright for key administration workflows, permission denial, form validation, and confirmation of high-risk operations.
- Add lower-level tests when components or business rules need faster feedback. Playwright does not replace API authorization tests.
- Figma pages require browser screenshots or visual comparison evidence; DOM presence alone is insufficient for acceptance.
