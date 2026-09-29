from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError

from fastapi import Depends
from app.core.config import settings
from app.core.security import require_module
from app.routers import auth, companies, branches, users, roles, dashboard, ai_assistant, sales_crm, inventory, purchase, manufacturing, hr, finance, service_desk

app = FastAPI(
    title="Nexus ERP API",
    description="Multi-company ERP suite — Login & Company Setup, Dashboard, AI Assistant, Sales + CRM, Inventory, Purchase, Manufacturing, HR & Employee, and Finance & GST modules.",
    version="2.12.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors(), "message": "Validation failed"},
    )


@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "service": "nexus-erp-api", "version": "2.11.0"}


app.include_router(auth.router)
app.include_router(companies.router)
app.include_router(branches.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(dashboard.router, dependencies=[Depends(require_module("dashboard"))])
app.include_router(ai_assistant.router)
app.include_router(sales_crm.router, dependencies=[Depends(require_module("sales_crm"))])
app.include_router(inventory.router, dependencies=[Depends(require_module("inventory"))])
app.include_router(purchase.router, dependencies=[Depends(require_module("purchase"))])
app.include_router(manufacturing.router, dependencies=[Depends(require_module("manufacturing"))])
app.include_router(hr.router, dependencies=[Depends(require_module("hr_employee"))])
app.include_router(finance.router, dependencies=[Depends(require_module("finance_gst"))])
app.include_router(service_desk.router, dependencies=[Depends(require_module("service_desk"))])
