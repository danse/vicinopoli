"""Export the OpenAPI schema to stdout for `make gen`."""

import json

from app.main import app

print(json.dumps(app.openapi(), indent=2))
