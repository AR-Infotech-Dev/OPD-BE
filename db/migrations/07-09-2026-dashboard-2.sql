-- Independent Dashboard 2 menu. The application route is /dashboard-2.
INSERT INTO ab_menu_master
  (menu_name, module_name, module_description, menu_link, table_name, icon_name,
   plural_label, label, menu_index, company_id, created_by, created_date, status)
SELECT
  'Dashboard 2', 'dashboard-2', 'Role-adaptive operations dashboard', '/dashboard-2',
  'dashboard_2', 'Gauge', 'Dashboard 2', 'Dashboard 2', 4, NULL, 75, NOW(), 'active'
WHERE NOT EXISTS (
  SELECT 1 FROM ab_menu_master WHERE menu_link IN ('dashboard-2', '/dashboard-2')
);

SET @dashboard_2_menu_id = (
  SELECT menu_id FROM ab_menu_master
  WHERE menu_link IN ('dashboard-2', '/dashboard-2')
  ORDER BY menu_id DESC LIMIT 1
);

-- Preserve role/user access by copying the existing Dashboard permission entry.
UPDATE ab_module_access
SET permissions = JSON_SET(
  COALESCE(permissions, JSON_OBJECT()),
  CONCAT('$."', @dashboard_2_menu_id, '"'),
  JSON_EXTRACT(permissions, '$."329"')
)
WHERE JSON_CONTAINS_PATH(permissions, 'one', '$."329"')
  AND NOT JSON_CONTAINS_PATH(permissions, 'one', CONCAT('$."', @dashboard_2_menu_id, '"'));
