# Node Setup

This folder contains a standard Node.js + Express scaffold for migrating the legacy PHP CodeIgniter API.

## What is already done

- Express app bootstrap with sessions, JSON parsing, logging, and error handling
- MySQL connection layer using the same database defaults found in `application/config/database.php`
- Legacy route loader that reads:
  - `application/config/routes.php`
  - `application/config/routes_custom.php`
  - `application/config/routes_integration.php`
- Auto-registration of the legacy routes in Express so the public route surface stays the same
- A migrated `Login` controller for:
  - `POST /login`
  - `GET|POST /salt`
  - `POST /logout`

## Current migration behavior

- Routes with a migrated Node controller execute real logic
- Routes without a migrated Node controller return `501 Not Implemented` with the original PHP mapping details

This makes the migration visible and incremental instead of losing route parity.

## Run

1. Create `.env` from `.env.example`
2. Install packages with `npm install`
3. Start the server with `npm run dev`

## Suggested next migration order

1. `SearchAdmin`
2. `CustomerMaster`
3. `MenuMaster`
4. `Dashboard`
5. `systems/*`


## Role-based permissions

Roles come from `user_role_master`; users inherit permissions through `admin.roleID`.
`role_module_access` has one record per (role_id, company_id). Only view/add/edit/delete
are stored, and each ancestor must have view access. Super Admin retains full access.

Before starting this backend on an existing database, run:

```sh
node src/scripts/migrateNestedMenus.js
node src/scripts/migrateRoleAccess.js
```

The role migration is additive and rerunnable. It preserves existing role rules and
seeds new ones from the intersection of active users’ effective legacy permissions.
A user without grants contributes no access, so a migrated role may start empty.
Legacy module_access rows remain for rollback but are no longer read at runtime.
Configure the resulting role rules through Access Control as Super Admin.
Authorization remains in the main database; company exports include role_module_access.

POST /permissions/roles lists company/role pairs. POST /permissions/:roleId reads rules;
POST /permissions/save/:roleId accepts {role_id, company_id, permissions}.
POST /my-permissions resolves the authenticated user’s current role; it never accepts
another user’s identity or company as an override. The old get-permissions/:id URLs
remain authenticated self-only aliases. Authentication refreshes role/company from
the database on each request, so old tokens cannot retain a previous role.
The frontend fetches permissions at login and stores them in localStorage. Reloads,
navigation and window focus reuse that snapshot without fetching permissions again.
Updated role rules appear in the frontend after the next login. Backend enforcement
still applies on the next request.

Run authorization regression checks without connecting to a database:

```sh
node tests/role-access.test.mjs
```
