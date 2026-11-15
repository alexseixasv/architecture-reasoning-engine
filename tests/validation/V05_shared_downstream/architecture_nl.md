Gateway ingress at 50 rps fans out 2 calls to Orders and 1 to Catalog per request. Both call Inventory once. Inventory has 2x100 rps capacity.
