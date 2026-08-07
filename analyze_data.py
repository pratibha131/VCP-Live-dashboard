from dashboard_parser import WorkbookDashboardStore
from app import EXCEL_PATH
import json

store = WorkbookDashboardStore(EXCEL_PATH)
data = store.dashboard_payload(None, 2026)

for func in data["functions"]:
    name = func["name"]
    print(f"=== {name} ===")
    print(f"  Keys: {list(func.keys())}")
    print(f"  theme_count: {func['theme_count']}")
    print(f"  total_actions: {func['total_actions_count']}")
    print(f"  completed: {func['completed_count']}")
    print(f"  active: {func['active_count']}")
    print(f"  risk: {func['risk_count']}")
    for kt in func["key_themes"]:
        print(f"  theme: {kt['name']} | progress: {kt['progress']} | status: {kt['status']} | actions: {kt['actions_count']}")
    print()

# Also examine themes structure in detail for first function
print("=== DETAILED THEME STRUCTURE (Service Transformation) ===")
st_data = store.dashboard_payload("Service Transformation", 2026)
for theme in st_data["themes"]:
    print(f"\nTheme: {theme['name']}")
    print(f"  Keys: {list(theme.keys())}")
    print(f"  progress: {theme.get('progress')}")
    print(f"  status: {theme.get('status')}")
    print(f"  status_label: {theme.get('status_label')}")
    deps = theme.get("dependencies", [])
    print(f"  dependencies count: {len(deps)}")
    actions = theme.get("actions", [])
    print(f"  actions count: {len(actions)}")
    if actions:
        a = actions[0]
        print(f"  sample action keys: {list(a.keys())}")
        print(f"  sample action: {json.dumps(a, indent=2, default=str)[:500]}")
