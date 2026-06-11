from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os, logging, bcrypt, jwt
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import smtplib, ssl, asyncio
from email.message import EmailMessage
import httpx
import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
app = FastAPI()
api_router = APIRouter(prefix="/api")
JWT_ALGORITHM = "HS256"
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Helpers ---
import uuid as _uuid
INSTANCE_ID = _uuid.uuid4().hex  # rotates on every backend restart → invalidates old JWTs

def hash_password(p): return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
def verify_password(p, h): return bcrypt.checkpw(p.encode("utf-8"), h.encode("utf-8"))
def get_jwt_secret(): return os.environ["JWT_SECRET"]

def create_access_token(uid, email, role):
    return jwt.encode({"sub": uid, "email": email, "role": role, "exp": datetime.now(timezone.utc) + timedelta(hours=8), "type": "access", "iid": INSTANCE_ID}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(uid):
    return jwt.encode({"sub": uid, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh", "iid": INSTANCE_ID}, get_jwt_secret(), algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request):
    token = request.cookies.get("access_token")
    if not token:
        ah = request.headers.get("Authorization", "")
        if ah.startswith("Bearer "): token = ah[7:]
    if not token: raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access": raise HTTPException(status_code=401, detail="Invalid token")
        # Force re-login on backend restart: any token issued by a previous instance is invalid
        if payload.get("iid") != INSTANCE_ID:
            raise HTTPException(status_code=401, detail="Session expired — please log in again")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user: raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError: raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError: raise HTTPException(status_code=401, detail="Invalid token")

ALL_PERMISSIONS = ["dashboard", "pos", "menu", "menu_edit", "inventory", "reports_x", "reports_z", "orders_history", "settings", "expenses", "vendors", "reprint_invoices", "refunds"]
ADMIN_PERMISSIONS = ALL_PERMISSIONS.copy()

# --- Models ---
class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "cashier"

class CategoryCreate(BaseModel):
    name: str
    color: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None

class MenuItemCreate(BaseModel):
    name: str
    price: float
    price_fp1: Optional[float] = None  # FoodPanda 1 price (overrides price when payment_type=foodpanda1)
    price_fp2: Optional[float] = None  # FoodPanda 2 price (overrides price when payment_type=foodpanda2)
    category_id: str
    stock: int = 100
    low_stock_threshold: int = 10
    color: Optional[str] = None

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    price_fp1: Optional[float] = None
    price_fp2: Optional[float] = None
    category_id: Optional[str] = None
    stock: Optional[int] = None
    low_stock_threshold: Optional[int] = None
    color: Optional[str] = None

class OrderItemInput(BaseModel):
    item_id: str
    name: str
    price: float
    original_price: Optional[float] = None
    quantity: int

class OrderCreate(BaseModel):
    items: List[OrderItemInput]
    payment_type: str
    subtotal: float
    tax: float
    total: float
    discount_type: Optional[str] = None
    discount_value: Optional[float] = 0
    discount_amount: Optional[float] = 0

class StockUpdate(BaseModel):
    stock: int

class UserCreate(BaseModel):
    email: str
    password: str
    name: str
    role: str = "cashier"
    permissions: Optional[List[str]] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    permissions: Optional[List[str]] = None

class SettingsUpdate(BaseModel):
    tax_rate: Optional[float] = None
    online_tax_rate: Optional[float] = None
    foodpanda1_tax_rate: Optional[float] = None
    foodpanda2_tax_rate: Optional[float] = None
    currency: Optional[str] = None
    restaurant_name: Optional[str] = None
    restaurant_address: Optional[str] = None
    restaurant_phone: Optional[str] = None
    restaurant_email: Optional[str] = None
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    email_recipients: Optional[List[Dict[str, Any]]] = None
    auto_email_on_z_close: Optional[bool] = None
    # Daily auto-send schedule
    daily_report_time: Optional[str] = None  # "HH:MM" 24h
    daily_report_timezone: Optional[str] = None  # IANA tz e.g., "Asia/Karachi"
    auto_email_daily: Optional[bool] = None
    auto_whatsapp_daily: Optional[bool] = None
    daily_report_type: Optional[str] = None  # "yesterday" | "today"
    # WhatsApp
    whatsapp_service_url: Optional[str] = None
    whatsapp_recipients: Optional[List[Dict[str, Any]]] = None
    auto_whatsapp_on_z_close: Optional[bool] = None
    # Cloudflare Tunnel
    tunnel_log_path: Optional[str] = None
    tunnel_notify_on_change: Optional[bool] = None
    # Receipt formatting
    receipt_font_family: Optional[str] = None
    receipt_base_size: Optional[int] = None
    receipt_header_size: Optional[int] = None
    receipt_total_size: Optional[int] = None
    receipt_bold_all: Optional[bool] = None
    receipt_bold_total: Optional[bool] = None
    receipt_show_logo: Optional[bool] = None
    receipt_footer_text: Optional[str] = None
    receipt_paper_width: Optional[int] = None  # in mm or pixels (CSS)
    receipt_show_tax_line: Optional[bool] = None
    # Branding – custom logo (base64 data URL, e.g. "data:image/png;base64,...")
    restaurant_logo: Optional[str] = None

class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: Optional[str] = "general"

class ExpenseUpdate(BaseModel):
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None

class VendorCreate(BaseModel):
    name: str
    contact: Optional[str] = ""
    items_supplied: Optional[str] = ""

class VendorUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    items_supplied: Optional[str] = None

class VendorTransactionCreate(BaseModel):
    vendor_id: str
    items: List[dict]  # [{name, quantity, unit_price}]
    total: float
    notes: Optional[str] = ""

class VendorPaymentCreate(BaseModel):
    vendor_id: str
    amount: float
    notes: Optional[str] = ""

class RefundCreate(BaseModel):
    order_id: str
    reason: str
    amount: float
    items: Optional[List[dict]] = None

# --- Auth ---
@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user: raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(req.password, user["password_hash"]): raise HTTPException(status_code=401, detail="Invalid email or password")
    uid = str(user["_id"])
    at = create_access_token(uid, email, user.get("role", "cashier"))
    rt = create_refresh_token(uid)
    response.set_cookie(key="access_token", value=at, httponly=True, secure=False, samesite="lax", max_age=28800, path="/")
    response.set_cookie(key="refresh_token", value=rt, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    perms = user.get("permissions", ADMIN_PERMISSIONS if user.get("role") == "admin" else ["pos", "reports_x"])
    return {"id": uid, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "cashier"), "permissions": perms, "token": at}

@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response):
    email = req.email.lower().strip()
    if await db.users.find_one({"email": email}): raise HTTPException(status_code=400, detail="Email already registered")
    hashed = hash_password(req.password)
    perms = ["pos", "reports_x"]
    doc = {"email": email, "password_hash": hashed, "name": req.name, "role": req.role, "permissions": perms, "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.users.insert_one(doc)
    uid = str(result.inserted_id)
    at = create_access_token(uid, email, req.role)
    rt = create_refresh_token(uid)
    response.set_cookie(key="access_token", value=at, httponly=True, secure=False, samesite="lax", max_age=28800, path="/")
    response.set_cookie(key="refresh_token", value=rt, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": uid, "email": email, "name": req.name, "role": req.role, "permissions": perms, "token": at}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    perms = user.get("permissions", ADMIN_PERMISSIONS if user.get("role") == "admin" else ["pos", "reports_x"])
    return {"id": user["_id"], "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "cashier"), "permissions": perms}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

# --- Users ---
@api_router.get("/users")
async def list_users(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    users = await db.users.find({}, {"password_hash": 0}).to_list(500)
    return [{"id": str(u["_id"]), "email": u["email"], "name": u.get("name", ""), "role": u.get("role", "cashier"), "permissions": u.get("permissions", ADMIN_PERMISSIONS if u.get("role") == "admin" else ["pos", "reports_x"]), "created_at": u.get("created_at", "")} for u in users]

@api_router.post("/users")
async def create_user(req: UserCreate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    email = req.email.lower().strip()
    if await db.users.find_one({"email": email}): raise HTTPException(status_code=400, detail="Email already exists")
    perms = req.permissions if req.permissions else (ADMIN_PERMISSIONS if req.role == "admin" else ["pos", "reports_x"])
    doc = {"email": email, "password_hash": hash_password(req.password), "name": req.name, "role": req.role, "permissions": perms, "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.users.insert_one(doc)
    return {"id": str(result.inserted_id), "email": email, "name": req.name, "role": req.role, "permissions": perms}

@api_router.put("/users/{user_id}")
async def update_user(user_id: str, req: UserUpdate, request: Request):
    current = await get_current_user(request)
    if current.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    update_data = {}
    if req.name is not None: update_data["name"] = req.name
    if req.role is not None: update_data["role"] = req.role
    if req.permissions is not None: update_data["permissions"] = req.permissions
    if req.password and req.password.strip(): update_data["password_hash"] = hash_password(req.password)
    if update_data: await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": update_data})
    updated = await db.users.find_one({"_id": ObjectId(user_id)}, {"password_hash": 0})
    if not updated: raise HTTPException(status_code=404, detail="User not found")
    return {"id": str(updated["_id"]), "email": updated["email"], "name": updated.get("name", ""), "role": updated.get("role", "cashier"), "permissions": updated.get("permissions", [])}

@api_router.delete("/users/{user_id}")
async def delete_user(user_id: str, request: Request):
    current = await get_current_user(request)
    if current.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    if current["_id"] == user_id: raise HTTPException(status_code=400, detail="Cannot delete yourself")
    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="User not found")
    return {"message": "User deleted"}

# --- Settings ---
DEFAULT_SETTINGS = {"tax_rate": 5.0, "online_tax_rate": 0.0, "foodpanda1_tax_rate": 0.0, "foodpanda2_tax_rate": 0.0, "currency": "Rs", "restaurant_name": "KARACHI NASEEB BIRYANI AND MURG PULAO", "restaurant_address": "68 Chatri Chowk, Punjab Small Industry, D Block, Lahore", "restaurant_phone": "+923004928411", "restaurant_email": "karachinaseebbiryani599@gmail.com", "smtp_host": "smtp.gmail.com", "smtp_port": 587, "smtp_user": "", "smtp_password": "", "smtp_from": "", "smtp_use_tls": True, "email_recipients": [], "auto_email_on_z_close": False, "daily_report_time": "02:15", "daily_report_timezone": "Asia/Karachi", "auto_email_daily": False, "auto_whatsapp_daily": False, "daily_report_type": "yesterday", "whatsapp_service_url": "http://127.0.0.1:3030", "whatsapp_recipients": [], "auto_whatsapp_on_z_close": False, "tunnel_log_path": "", "tunnel_notify_on_change": True, "receipt_font_family": "Courier New", "receipt_base_size": 12, "receipt_header_size": 16, "receipt_total_size": 16, "receipt_bold_all": False, "receipt_bold_total": True, "receipt_show_logo": False, "receipt_footer_text": "Thank you for your order!", "receipt_paper_width": 300, "receipt_show_tax_line": True, "restaurant_logo": ""}

@api_router.get("/settings")
async def get_settings(request: Request):
    await get_current_user(request)
    s = await db.settings.find_one({"key": "global"}, {"_id": 0})
    if not s: return DEFAULT_SETTINGS
    return {k: s.get(k, v) for k, v in DEFAULT_SETTINGS.items()}

@api_router.put("/settings")
async def update_settings(req: SettingsUpdate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    ud = {k: v for k, v in req.model_dump().items() if v is not None}
    if ud: await db.settings.update_one({"key": "global"}, {"$set": ud}, upsert=True)
    s = await db.settings.find_one({"key": "global"}, {"_id": 0})
    schedule_keys = ("daily_report_time", "daily_report_timezone", "auto_email_daily", "auto_whatsapp_daily")
    if any(k in ud for k in schedule_keys):
        logger.info(f"Settings: schedule fields changed: {[k for k in schedule_keys if k in ud]}")
        try: await _reschedule_daily_job()
        except Exception as e: logger.exception(f"Reschedule failed: {e}")
    return {k: s.get(k, v) for k, v in DEFAULT_SETTINGS.items()} if s else DEFAULT_SETTINGS

# --- Categories ---
def _can_edit_menu(user):
    return user.get("role") == "admin" or "menu_edit" in (user.get("permissions") or [])

@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find({}).sort([("sort_order", 1), ("created_at", 1)]).to_list(100)
    return [{"id": str(c["_id"]), "name": c["name"], "color": c.get("color"), "sort_order": c.get("sort_order", 0)} for c in cats]

@api_router.post("/categories")
async def create_category(cat: CategoryCreate, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    count = await db.categories.count_documents({})
    result = await db.categories.insert_one({"name": cat.name, "color": cat.color, "sort_order": count, "created_at": datetime.now(timezone.utc).isoformat()})
    return {"id": str(result.inserted_id), "name": cat.name, "color": cat.color, "sort_order": count}

@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, cat: CategoryUpdate, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    ud = {k: v for k, v in cat.model_dump().items() if v is not None}
    if ud: await db.categories.update_one({"_id": ObjectId(cat_id)}, {"$set": ud})
    updated = await db.categories.find_one({"_id": ObjectId(cat_id)}, {"_id": 0})
    if not updated: raise HTTPException(status_code=404, detail="Not found")
    return {"id": cat_id, "name": updated.get("name"), "color": updated.get("color"), "sort_order": updated.get("sort_order", 0)}

@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    await db.categories.delete_one({"_id": ObjectId(cat_id)})
    await db.menu_items.delete_many({"category_id": cat_id})
    return {"message": "Deleted"}

@api_router.post("/categories/reorder")
async def reorder_categories(payload: dict, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    order = payload.get("order") or []
    for idx, cid in enumerate(order):
        try:
            await db.categories.update_one({"_id": ObjectId(cid)}, {"$set": {"sort_order": idx}})
        except Exception:
            pass
    return {"message": "Reordered", "count": len(order)}

# --- Menu Items ---
@api_router.get("/menu-items")
async def get_menu_items():
    items = await db.menu_items.find({}).sort([("sort_order", 1), ("created_at", 1)]).to_list(500)
    return [{"id": str(i["_id"]), "name": i["name"], "price": i["price"], "price_fp1": i.get("price_fp1"), "price_fp2": i.get("price_fp2"), "category_id": i["category_id"], "stock": i.get("stock", 0), "low_stock_threshold": i.get("low_stock_threshold", 10), "color": i.get("color"), "sort_order": i.get("sort_order", 0)} for i in items]

@api_router.post("/menu-items")
async def create_menu_item(item: MenuItemCreate, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    count = await db.menu_items.count_documents({})
    doc = {"name": item.name, "price": item.price, "price_fp1": item.price_fp1, "price_fp2": item.price_fp2, "category_id": item.category_id, "stock": item.stock, "low_stock_threshold": item.low_stock_threshold, "color": item.color, "sort_order": count, "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.menu_items.insert_one(doc)
    return {"id": str(result.inserted_id), "name": item.name, "price": item.price, "price_fp1": item.price_fp1, "price_fp2": item.price_fp2, "category_id": item.category_id, "stock": item.stock, "low_stock_threshold": item.low_stock_threshold, "color": item.color, "sort_order": count}

@api_router.put("/menu-items/{item_id}")
async def update_menu_item(item_id: str, item: MenuItemUpdate, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    ud = {k: v for k, v in item.model_dump().items() if v is not None}
    if ud: await db.menu_items.update_one({"_id": ObjectId(item_id)}, {"$set": ud})
    updated = await db.menu_items.find_one({"_id": ObjectId(item_id)}, {"_id": 0})
    if not updated: raise HTTPException(status_code=404, detail="Not found")
    updated["id"] = item_id
    return updated

@api_router.delete("/menu-items/{item_id}")
async def delete_menu_item(item_id: str, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    await db.menu_items.delete_one({"_id": ObjectId(item_id)})
    return {"message": "Deleted"}

@api_router.post("/menu-items/reorder")
async def reorder_menu_items(payload: dict, request: Request):
    user = await get_current_user(request)
    if not _can_edit_menu(user): raise HTTPException(status_code=403, detail="Menu edit permission required")
    order = payload.get("order") or []
    for idx, iid in enumerate(order):
        try:
            await db.menu_items.update_one({"_id": ObjectId(iid)}, {"$set": {"sort_order": idx}})
        except Exception:
            pass
    return {"message": "Reordered", "count": len(order)}

# --- Inventory ---
@api_router.get("/inventory")
async def get_inventory(request: Request):
    await get_current_user(request)
    items = await db.menu_items.find({}).to_list(500)
    result = []
    for i in items:
        cat = None
        cid = i.get("category_id")
        if cid:
            try: cat = await db.categories.find_one({"_id": ObjectId(cid)})
            except: cat = None
        result.append({"id": str(i["_id"]), "name": i["name"], "price": i["price"], "category_name": cat["name"] if cat else "Uncategorized", "stock": i.get("stock", 0), "low_stock_threshold": i.get("low_stock_threshold", 10), "is_low_stock": i.get("stock", 0) <= i.get("low_stock_threshold", 10)})
    return result

@api_router.put("/inventory/{item_id}")
async def update_stock(item_id: str, su: StockUpdate, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    await db.menu_items.update_one({"_id": ObjectId(item_id)}, {"$set": {"stock": su.stock}})
    return {"message": "Stock updated", "stock": su.stock}

# --- Orders ---
@api_router.post("/orders")
async def create_order(order: OrderCreate, request: Request):
    user = await get_current_user(request)
    for oi in order.items:
        try:
            item = await db.menu_items.find_one({"_id": ObjectId(oi.item_id)})
            if item: await db.menu_items.update_one({"_id": ObjectId(oi.item_id)}, {"$set": {"stock": max(0, item.get("stock", 0) - oi.quantity)}})
        except: pass
    now = datetime.now(timezone.utc)
    doc = {"items": [{"item_id": oi.item_id, "name": oi.name, "price": oi.price, "original_price": oi.original_price or oi.price, "quantity": oi.quantity} for oi in order.items], "payment_type": order.payment_type, "subtotal": order.subtotal, "tax": order.tax, "total": order.total, "discount_type": order.discount_type, "discount_value": order.discount_value or 0, "discount_amount": order.discount_amount or 0, "cashier_id": user["_id"], "cashier_name": user.get("name", ""), "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")}
    result = await db.orders.insert_one(doc)
    return {"id": str(result.inserted_id), "items": doc["items"], "payment_type": order.payment_type, "subtotal": order.subtotal, "tax": order.tax, "total": order.total, "discount_amount": order.discount_amount or 0, "cashier_name": user.get("name", ""), "created_at": now.isoformat()}

@api_router.get("/orders/today")
async def get_today_orders(request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    orders = await db.orders.find({"date": today}).sort("created_at", -1).to_list(1000)
    out = []
    for o in orders:
        oid = str(o.pop("_id"))
        o["id"] = oid
        o["receipt_no"] = oid[-6:].upper()
        out.append(o)
    return out

@api_router.get("/orders/history")
async def get_orders_history(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None, payment_type: Optional[str] = None, q: Optional[str] = None, limit: int = 500):
    user = await get_current_user(request)
    perms = user.get("permissions") or []
    if user.get("role") != "admin" and "orders_history" not in perms:
        raise HTTPException(status_code=403, detail="Orders history permission required")
    query = {}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    elif end_date:
        query["date"] = {"$lte": end_date}
    if payment_type and payment_type != "all":
        query["payment_type"] = payment_type
    orders = await db.orders.find(query).sort("created_at", -1).to_list(max(1, min(limit, 5000)))
    out = []
    for o in orders:
        oid = str(o.pop("_id"))
        o["id"] = oid
        o["receipt_no"] = oid[-6:].upper()
        if q:
            ql = q.lower().strip()
            hay = f"{o['receipt_no']} {o.get('cashier_name','')} {o.get('date','')}".lower()
            items_hay = " ".join([str(i.get("name","")) for i in o.get("items", [])]).lower()
            if ql not in hay and ql not in items_hay:
                continue
        out.append(o)
    return out

@api_router.get("/orders/search/{receipt_id}")
async def search_order(receipt_id: str, request: Request):
    await get_current_user(request)
    # Search by last 6 chars of _id
    orders = await db.orders.find({}).to_list(50000)
    for o in orders:
        oid = str(o["_id"])
        if oid.endswith(receipt_id.lower()) or oid[-6:].upper() == receipt_id.upper():
            o.pop("_id", None)
            o["id"] = oid
            return o
    raise HTTPException(status_code=404, detail="Receipt not found")

# --- Voice Assistant (Urdu / Punjabi) ---
# Pipeline: audio → Whisper STT → GPT-4o parser → structured items + Urdu confirmation + TTS audio
import io, base64, json as _json

_EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

def _voice_ready():
    return bool(_EMERGENT_KEY)

async def _stt_transcribe(audio_bytes: bytes, filename: str, language: Optional[str] = None) -> str:
    from emergentintegrations.llm.openai.speech_to_text import OpenAISpeechToText
    stt = OpenAISpeechToText(api_key=_EMERGENT_KEY)
    bio = io.BytesIO(audio_bytes); bio.name = filename or "audio.webm"
    res = await stt.transcribe(bio, "whisper-1", "json", None, language)
    if isinstance(res, dict):
        return res.get("text", "")
    if hasattr(res, "text"):
        return res.text
    return str(res)

async def _llm_parse_order(transcript: str, menu_names: List[str]) -> dict:
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    system = (
        "You parse restaurant POS orders spoken in Urdu, Punjabi, Hindi, or English. "
        "Return ONLY compact JSON – no prose. Schema: "
        '{"intent":"order"|"expense"|"unknown","items":[{"name":str,"qty":int}],"expense":{"description":str,"amount":float}|null,"confidence":0..1}. '
        f"Available menu item names (match case-insensitively; pick the closest one): {menu_names}. "
        "Urdu/Punjabi numbers: ek=1, do=2, tin=3, char=4, paanch=5, chha=6, saat=7, aath=8, nau=9, dus=10. "
        "If user says something like 'kharch', 'expense', 'spent', 'kharcha', treat as expense and extract amount + description. "
        "If nothing matches confidently, set intent='unknown' and items=[]."
    )
    chat = LlmChat(api_key=_EMERGENT_KEY, session_id=f"voice-{datetime.now(timezone.utc).timestamp()}", system_message=system).with_model("openai", "gpt-4o-mini")
    reply = await chat.send_message(UserMessage(text=f"Transcript: {transcript}\nReturn only JSON."))
    text = reply if isinstance(reply, str) else getattr(reply, "content", str(reply))
    # strip code fences
    t = text.strip()
    if t.startswith("```"):
        t = t.strip("`")
        if t.lower().startswith("json"): t = t[4:]
    try:
        return _json.loads(t)
    except Exception:
        # try to find first {...}
        start = t.find("{"); end = t.rfind("}")
        if start >= 0 and end > start:
            try: return _json.loads(t[start:end+1])
            except Exception: pass
        return {"intent": "unknown", "items": [], "expense": None, "confidence": 0.0}

async def _tts_speak(text: str, voice: str = "alloy") -> bytes:
    from emergentintegrations.llm.openai.text_to_speech import OpenAITextToSpeech
    tts = OpenAITextToSpeech(api_key=_EMERGENT_KEY)
    return await tts.generate_speech(text=text, model="tts-1", voice=voice, speed=1.0, response_format="mp3")

def _build_urdu_confirmation(parsed: dict, currency: str, items_resolved: list, total: float) -> str:
    """
    Build a confirmation that keeps NUMBERS and ITEM NAMES in English (TTS pronounces them clearly)
    while connector words stay in Urdu so it still feels native.
    """
    intent = parsed.get("intent", "unknown")
    if intent == "expense" and parsed.get("expense"):
        e = parsed["expense"]
        return f"خرچہ — {e.get('description','')} — {currency} {int(e.get('amount',0))}۔ کیا آپ تصدیق کرتے ہیں؟"
    if intent == "order" and items_resolved:
        parts = []
        for it in items_resolved:
            q = int(it.get("quantity", 1))
            # English digits + English item name = clear TTS, Urdu structure around it
            parts.append(f"{q} {it['name']}")
        items_text = " اور ".join(parts)  # Urdu "and"
        return f"آپ کا آرڈر — {items_text}۔ کل {currency} {int(total)}۔ کیا آپ تصدیق کرتے ہیں؟"
    return "معاف کیجیے، میں سمجھ نہیں سکا۔ براہ کرم دوبارہ کہیں۔"

@api_router.get("/voice/status")
async def voice_status(request: Request):
    await get_current_user(request)
    return {"enabled": _voice_ready()}

@api_router.post("/voice/parse")
async def voice_parse(request: Request, audio: UploadFile = File(...), language: Optional[str] = Form(None)):
    """Accept an audio blob, transcribe, parse against current menu, and return parsed order + Urdu TTS."""
    await get_current_user(request)
    if not _voice_ready():
        raise HTTPException(status_code=503, detail="Voice assistant not configured (EMERGENT_LLM_KEY missing)")
    data = await audio.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio")
    if len(data) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Audio too large (max 25MB)")

    try:
        transcript = await _stt_transcribe(data, audio.filename or "audio.webm", language)
    except Exception as e:
        logger.exception("STT failed")
        raise HTTPException(status_code=502, detail=f"Transcription failed: {str(e)[:200]}")
    if not transcript or not transcript.strip():
        raise HTTPException(status_code=422, detail="Could not transcribe any speech. Please try again.")

    menu_docs = await db.menu_items.find({}).to_list(500)
    menu_index = {m["name"].lower(): {"id": str(m["_id"]), "name": m["name"], "price": m.get("price", 0), "stock": m.get("stock", 0)} for m in menu_docs}
    menu_names = list(menu_index.keys())

    try:
        parsed = await _llm_parse_order(transcript, menu_names)
    except Exception as e:
        logger.exception("LLM parse failed")
        raise HTTPException(status_code=502, detail=f"Parser failed: {str(e)[:200]}")

    # Resolve items against menu
    items_resolved = []
    subtotal = 0.0
    for it in (parsed.get("items") or []):
        nm = str(it.get("name", "")).lower().strip()
        qty = int(it.get("qty") or 1)
        if not nm: continue
        m = menu_index.get(nm)
        if not m:
            # fuzzy: find a menu name containing the token or vice versa
            for k, v in menu_index.items():
                if nm in k or k in nm:
                    m = v; break
        if m:
            items_resolved.append({"item_id": m["id"], "name": m["name"], "price": m["price"], "quantity": qty})
            subtotal += m["price"] * qty

    s = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    currency = s.get("currency", "Rs")
    urdu_text = _build_urdu_confirmation(parsed, currency, items_resolved, subtotal)

    try:
        audio_bytes = await _tts_speak(urdu_text)
        audio_b64 = base64.b64encode(audio_bytes).decode()
    except Exception as e:
        logger.warning(f"TTS failed (non-fatal): {e}")
        audio_b64 = ""

    return {
        "transcript": transcript,
        "parsed": parsed,
        "items": items_resolved,
        "subtotal": round(subtotal, 2),
        "expense": parsed.get("expense"),
        "intent": parsed.get("intent", "unknown"),
        "confirmation_text": urdu_text,
        "audio_base64": audio_b64,
        "currency": currency,
    }

# --- Refunds ---
@api_router.post("/refunds")
async def create_refund(refund: RefundCreate, request: Request):
    user = await get_current_user(request)
    perms = user.get("permissions", [])
    if user.get("role") != "admin" and "refunds" not in perms:
        raise HTTPException(status_code=403, detail="Refund permission required")
    now = datetime.now(timezone.utc)
    refund_no = f"RF-{await db.refunds.count_documents({}) + 1:05d}"
    doc = {
        "refund_no": refund_no,
        "order_id": refund.order_id,
        "reason": refund.reason,
        "amount": refund.amount,
        "items": refund.items or [],
        "refunded_by": user["_id"],
        "refunded_by_name": user.get("name", ""),
        "date": now.strftime("%Y-%m-%d"),
        "created_at": now.isoformat(),
    }
    result = await db.refunds.insert_one(doc)
    return {"id": str(result.inserted_id), "refund_no": refund_no, "amount": refund.amount, "reason": refund.reason, "date": now.strftime("%Y-%m-%d"), "created_at": now.isoformat(), "refunded_by_name": user.get("name", "")}

@api_router.get("/refunds/today")
async def get_today_refunds(request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    refunds = await db.refunds.find({"date": today}).sort("created_at", -1).to_list(500)
    return [{"id": str(r["_id"]), "refund_no": r.get("refund_no", ""), "order_id": r.get("order_id", ""), "reason": r.get("reason", ""), "amount": r.get("amount", 0), "items": r.get("items", []), "refunded_by_name": r.get("refunded_by_name", ""), "date": r.get("date", ""), "created_at": r.get("created_at", "")} for r in refunds]

@api_router.get("/refunds/summary")
async def get_refund_summary(request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    refunds = await db.refunds.find({"date": today}).to_list(500)
    total = sum(r.get("amount", 0) for r in refunds)
    return {"date": today, "total_refunds": round(total, 2), "count": len(refunds)}

# --- Expenses ---
@api_router.get("/expenses")
async def get_expenses(request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    exps = await db.expenses.find({"date": today}).sort("created_at", -1).to_list(500)
    return [{"id": str(e["_id"]), "description": e["description"], "amount": e["amount"], "category": e.get("category", "general"), "created_at": e.get("created_at", ""), "date": e.get("date", today)} for e in exps]

@api_router.post("/expenses")
async def create_expense(exp: ExpenseCreate, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    doc = {"description": exp.description, "amount": exp.amount, "category": exp.category or "general", "created_by": user["_id"], "created_by_name": user.get("name", ""), "created_at": now.isoformat(), "date": now.strftime("%Y-%m-%d")}
    result = await db.expenses.insert_one(doc)
    return {"id": str(result.inserted_id), "description": exp.description, "amount": exp.amount, "category": exp.category, "created_at": now.isoformat()}

@api_router.delete("/expenses/{exp_id}")
async def delete_expense(exp_id: str, request: Request):
    await get_current_user(request)
    await db.expenses.delete_one({"_id": ObjectId(exp_id)})
    return {"message": "Deleted"}

@api_router.get("/expenses/summary")
async def get_expenses_summary(request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    exps = await db.expenses.find({"date": today}).to_list(500)
    total = sum(e.get("amount", 0) for e in exps)
    return {"date": today, "total_expenses": round(total, 2), "count": len(exps)}

# --- Vendors ---
@api_router.get("/vendors")
async def list_vendors(request: Request):
    await get_current_user(request)
    vendors = await db.vendors.find({}).to_list(500)
    result = []
    for v in vendors:
        vid = str(v["_id"])
        txns = await db.vendor_transactions.find({"vendor_id": vid}).to_list(10000)
        pmts = await db.vendor_payments.find({"vendor_id": vid}).to_list(10000)
        total_billed = sum(t.get("total", 0) for t in txns)
        total_paid = sum(p.get("amount", 0) for p in pmts)
        balance = round(total_billed - total_paid, 2)
        result.append({"id": vid, "name": v["name"], "contact": v.get("contact", ""), "items_supplied": v.get("items_supplied", ""), "products": v.get("products", []), "total_billed": round(total_billed, 2), "total_paid": round(total_paid, 2), "balance": balance})
    return result

@api_router.post("/vendors")
async def create_vendor(v: VendorCreate, request: Request):
    user = await get_current_user(request)
    doc = {"name": v.name, "contact": v.contact, "items_supplied": v.items_supplied, "products": [], "created_at": datetime.now(timezone.utc).isoformat()}
    result = await db.vendors.insert_one(doc)
    return {"id": str(result.inserted_id), "name": v.name, "contact": v.contact, "items_supplied": v.items_supplied, "products": [], "total_billed": 0, "total_paid": 0, "balance": 0}

@api_router.put("/vendors/{vendor_id}")
async def update_vendor(vendor_id: str, v: VendorUpdate, request: Request):
    await get_current_user(request)
    ud = {k: val for k, val in v.model_dump().items() if val is not None}
    if ud: await db.vendors.update_one({"_id": ObjectId(vendor_id)}, {"$set": ud})
    return {"message": "Updated"}

@api_router.delete("/vendors/{vendor_id}")
async def delete_vendor(vendor_id: str, request: Request):
    await get_current_user(request)
    await db.vendors.delete_one({"_id": ObjectId(vendor_id)})
    return {"message": "Deleted"}

@api_router.get("/vendors/{vendor_id}/products")
async def get_vendor_products(vendor_id: str, request: Request):
    await get_current_user(request)
    vendor = await db.vendors.find_one({"_id": ObjectId(vendor_id)})
    if not vendor: raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor.get("products", [])

@api_router.post("/vendors/{vendor_id}/products")
async def add_vendor_product(vendor_id: str, request: Request):
    await get_current_user(request)
    body = await request.json()
    name = body.get("name", "").strip()
    default_price = body.get("default_price", 0)
    if not name: raise HTTPException(status_code=400, detail="Product name required")
    await db.vendors.update_one({"_id": ObjectId(vendor_id)}, {"$push": {"products": {"name": name, "default_price": default_price}}})
    return {"message": "Product added", "name": name, "default_price": default_price}

@api_router.delete("/vendors/{vendor_id}/products/{product_name}")
async def remove_vendor_product(vendor_id: str, product_name: str, request: Request):
    await get_current_user(request)
    await db.vendors.update_one({"_id": ObjectId(vendor_id)}, {"$pull": {"products": {"name": product_name}}})
    return {"message": "Product removed"}

@api_router.get("/vendors/{vendor_id}/transactions")
async def get_vendor_transactions(vendor_id: str, request: Request):
    await get_current_user(request)
    txns = await db.vendor_transactions.find({"vendor_id": vendor_id}).sort("created_at", -1).to_list(500)
    return [{"id": str(t["_id"]), "ticket_no": t.get("ticket_no", ""), "vendor_id": t["vendor_id"], "items": t.get("items", []), "total": t.get("total", 0), "notes": t.get("notes", ""), "date": t.get("date", ""), "created_at": t.get("created_at", "")} for t in txns]

@api_router.post("/vendors/{vendor_id}/transactions")
async def create_vendor_transaction(vendor_id: str, txn: VendorTransactionCreate, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    # Generate ticket number
    count = await db.vendor_transactions.count_documents({}) + 1
    ticket_no = f"VT-{count:05d}"
    doc = {"vendor_id": vendor_id, "ticket_no": ticket_no, "items": txn.items, "total": txn.total, "notes": txn.notes, "created_by": user["_id"], "date": now.strftime("%Y-%m-%d"), "created_at": now.isoformat()}
    result = await db.vendor_transactions.insert_one(doc)
    return {"id": str(result.inserted_id), "ticket_no": ticket_no, "vendor_id": vendor_id, "items": txn.items, "total": txn.total, "notes": txn.notes, "date": now.strftime("%Y-%m-%d"), "created_at": now.isoformat()}

@api_router.get("/vendors/{vendor_id}/payments")
async def get_vendor_payments(vendor_id: str, request: Request):
    await get_current_user(request)
    pmts = await db.vendor_payments.find({"vendor_id": vendor_id}).sort("created_at", -1).to_list(500)
    return [{"id": str(p["_id"]), "vendor_id": p["vendor_id"], "amount": p.get("amount", 0), "notes": p.get("notes", ""), "date": p.get("date", ""), "created_at": p.get("created_at", "")} for p in pmts]

@api_router.post("/vendors/{vendor_id}/payments")
async def create_vendor_payment(vendor_id: str, pmt: VendorPaymentCreate, request: Request):
    user = await get_current_user(request)
    now = datetime.now(timezone.utc)
    doc = {"vendor_id": vendor_id, "amount": pmt.amount, "notes": pmt.notes, "created_by": user["_id"], "date": now.strftime("%Y-%m-%d"), "created_at": now.isoformat()}
    result = await db.vendor_payments.insert_one(doc)
    return {"id": str(result.inserted_id), "amount": pmt.amount, "notes": pmt.notes, "date": now.strftime("%Y-%m-%d")}

@api_router.get("/vendors/{vendor_id}/today")
async def get_vendor_today(vendor_id: str, request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    txns = await db.vendor_transactions.find({"vendor_id": vendor_id, "date": today}).to_list(500)
    pmts = await db.vendor_payments.find({"vendor_id": vendor_id, "date": today}).to_list(500)
    billed = sum(t.get("total", 0) for t in txns)
    paid = sum(p.get("amount", 0) for p in pmts)
    items = []
    for t in txns:
        for i in t.get("items", []):
            items.append(i)
    return {"date": today, "items": items, "total_billed": round(billed, 2), "total_paid": round(paid, 2), "balance": round(billed - paid, 2), "transactions": len(txns)}

# --- Reports ---
def calc_report(orders, expenses=None, refunds=None):
    total_sales = sum(o.get("total", 0) for o in orders)
    cash = sum(o.get("total", 0) for o in orders if o.get("payment_type") == "cash")
    credit = sum(o.get("total", 0) for o in orders if o.get("payment_type") == "credit")
    fp1 = sum(o.get("total", 0) for o in orders if o.get("payment_type") == "foodpanda1")
    fp2 = sum(o.get("total", 0) for o in orders if o.get("payment_type") == "foodpanda2")
    online = fp1 + fp2
    total_orders = len(orders)
    total_items = sum(sum(i.get("quantity", 0) for i in o.get("items", [])) for o in orders)
    ic = {}
    for o in orders:
        for i in o.get("items", []):
            k = i.get("name", "Unknown")
            ic[k] = ic.get(k, 0) + i.get("quantity", 0)
    top = sorted(ic.items(), key=lambda x: x[1], reverse=True)[:10]
    total_exp = sum(e.get("amount", 0) for e in (expenses or []))
    total_ref = sum(r.get("amount", 0) for r in (refunds or []))
    return {"total_sales": round(total_sales, 2), "cash_sales": round(cash, 2), "credit_sales": round(credit, 2), "foodpanda1_sales": round(fp1, 2), "foodpanda2_sales": round(fp2, 2), "online_sales": round(online, 2), "total_orders": total_orders, "total_items_sold": total_items, "top_items": [{"name": n, "quantity": q} for n, q in top], "total_expenses": round(total_exp, 2), "total_refunds": round(total_ref, 2), "net_revenue": round(total_sales - total_exp - total_ref, 2)}

@api_router.get("/reports/x")
async def get_x_report(request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    orders = await db.orders.find({"date": today}).to_list(10000)
    expenses = await db.expenses.find({"date": today}).to_list(500)
    refunds = await db.refunds.find({"date": today}).to_list(500)
    r = calc_report(orders, expenses, refunds)
    r.update({"date": today, "report_type": "X", "generated_at": datetime.now(timezone.utc).isoformat()})
    return r

@api_router.get("/reports/z")
async def get_z_report(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin" and "reports_z" not in (user.get("permissions") or []):
        raise HTTPException(status_code=403, detail="Z Report permission required")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    orders = await db.orders.find({"date": today}).to_list(10000)
    expenses = await db.expenses.find({"date": today}).to_list(500)
    refunds = await db.refunds.find({"date": today}).to_list(500)
    r = calc_report(orders, expenses, refunds)
    r.update({"date": today, "report_type": "Z", "generated_at": datetime.now(timezone.utc).isoformat()})
    return r

@api_router.post("/reports/z/close")
async def close_z_report(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin" and "reports_z" not in (user.get("permissions") or []):
        raise HTTPException(status_code=403, detail="Z Report permission required")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if await db.z_reports.find_one({"date": today}): raise HTTPException(status_code=400, detail="Z Report already closed for today")
    orders = await db.orders.find({"date": today}).to_list(10000)
    expenses = await db.expenses.find({"date": today}).to_list(500)
    refunds = await db.refunds.find({"date": today}).to_list(500)
    r = calc_report(orders, expenses, refunds)
    r.update({"date": today, "report_type": "Z", "closed_at": datetime.now(timezone.utc).isoformat(), "closed_by": user["_id"]})
    await db.z_reports.insert_one(r)
    response = {"message": "Z Report closed and archived", "report": {k: v for k, v in r.items() if k != "_id"}}

    # Auto-email if configured
    try:
        s = await _get_settings_doc()
        if s.get("auto_email_on_z_close") and s.get("smtp_host") and s.get("smtp_user") and s.get("smtp_password"):
            recipients = _filter_recipients(s.get("email_recipients", []), "Z")
            if recipients:
                rep = {**r}
                rep.pop("_id", None)
                rep["report_type"] = "Z"
                subject, plain, html = _format_report_email(rep, s)
                await asyncio.to_thread(_send_email_sync, s["smtp_host"], s["smtp_port"], s.get("smtp_user",""), s.get("smtp_password",""), bool(s.get("smtp_use_tls", True)), s.get("smtp_from") or s.get("smtp_user"), recipients, subject, plain, html)
                response["emailed_to"] = recipients
    except Exception as e:
        logger.error(f"Auto-email on Z close failed: {e}")
        response["email_error"] = str(e)[:200]

    return response

@api_router.get("/reports/history")
async def get_report_history(request: Request, start_date: Optional[str] = None, end_date: Optional[str] = None):
    user = await get_current_user(request)
    if user.get("role") != "admin" and "reports_z" not in (user.get("permissions") or []):
        raise HTTPException(status_code=403, detail="Z Report permission required")
    query = {}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    elif start_date:
        query["date"] = {"$gte": start_date}
    else:
        two_months_ago = (datetime.now(timezone.utc) - timedelta(days=60)).strftime("%Y-%m-%d")
        query["date"] = {"$gte": two_months_ago}
    reports = await db.z_reports.find(query, {"_id": 0}).sort("date", -1).to_list(100)
    return reports

@api_router.get("/reports/export/csv")
async def export_report_csv(request: Request):
    await get_current_user(request)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    orders = await db.orders.find({"date": today}, {"_id": 0}).to_list(10000)
    rows = []
    for o in orders:
        for item in o.get("items", []):
            rows.append({"date": o.get("date"), "time": o.get("created_at", ""), "item_name": item.get("name"), "quantity": item.get("quantity", 0), "unit_price": item.get("price", 0), "line_total": round(item.get("price", 0) * item.get("quantity", 0), 2), "payment_type": o.get("payment_type"), "discount": o.get("discount_amount", 0), "order_total": o.get("total", 0), "cashier": o.get("cashier_name", "")})
    return rows

@api_router.get("/reports/history/export")
async def export_history_csv(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin" and "reports_z" not in (user.get("permissions") or []):
        raise HTTPException(status_code=403, detail="Z Report permission required")
    two_months_ago = (datetime.now(timezone.utc) - timedelta(days=60)).strftime("%Y-%m-%d")
    return await db.z_reports.find({"date": {"$gte": two_months_ago}}, {"_id": 0}).sort("date", -1).to_list(100)

# --- Email Reports ---
def _format_report_email(report: dict, settings: dict) -> tuple:
    """Returns (subject, plain_body, html_body) for a report email."""
    rname = settings.get("restaurant_name", "RestoPOS")
    cur = settings.get("currency", "Rs")
    rtype = report.get("report_type", "X")
    date = report.get("date", "")

    def fmt(v):
        try: return f"{cur} {float(v):,.2f}"
        except: return f"{cur} 0.00"

    subject = f"[{rname}] {rtype}-Report — {date}"

    lines = [
        f"{rname}",
        f"{rtype}-Report for {date}",
        "=" * 50,
        "",
        f"Total Sales:        {fmt(report.get('total_sales', 0))}",
        f"  Cash:             {fmt(report.get('cash_sales', 0))}",
        f"  Card:             {fmt(report.get('credit_sales', 0))}",
        f"  FoodPanda 1:      {fmt(report.get('foodpanda1_sales', 0))}",
        f"  FoodPanda 2:      {fmt(report.get('foodpanda2_sales', 0))}",
        "",
        f"Total Orders:       {report.get('total_orders', 0)}",
        f"Items Sold:         {report.get('total_items_sold', 0)}",
        f"Expenses:           {fmt(report.get('total_expenses', 0))}",
        f"Refunds:            {fmt(report.get('total_refunds', 0))}",
        f"Net Revenue:        {fmt(report.get('net_revenue', 0))}",
        "",
        "Top Items:",
    ]
    for ti in (report.get("top_items") or [])[:10]:
        lines.append(f"  - {ti.get('name')} × {ti.get('quantity')}")
    lines += ["", "—", "Sent automatically by RestoPOS"]
    plain = "\n".join(lines)

    rows_html = "".join(
        f"<tr><td style='padding:4px 12px'>{ti.get('name')}</td><td style='padding:4px 12px;text-align:right'>{ti.get('quantity')}</td></tr>"
        for ti in (report.get("top_items") or [])[:10]
    )
    html = f"""<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#1A1D1A;background:#F9F8F6;padding:24px">
<div style="max-width:600px;margin:auto;background:white;border:1px solid #E5E2DC;border-radius:12px;overflow:hidden">
  <div style="background:#1E3F20;color:white;padding:20px"><h2 style="margin:0">{rname}</h2><p style="margin:4px 0 0;opacity:0.85">{rtype}-Report — {date}</p></div>
  <div style="padding:24px">
    <h3 style="margin:0 0 12px;color:#1E3F20">Sales Summary</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0">Total Sales</td><td style="text-align:right;font-weight:bold">{fmt(report.get('total_sales',0))}</td></tr>
      <tr style="color:#5C5F5C"><td style="padding:4px 0 4px 16px">Cash</td><td style="text-align:right">{fmt(report.get('cash_sales',0))}</td></tr>
      <tr style="color:#5C5F5C"><td style="padding:4px 0 4px 16px">Card</td><td style="text-align:right">{fmt(report.get('credit_sales',0))}</td></tr>
      <tr style="color:#5C5F5C"><td style="padding:4px 0 4px 16px">FoodPanda 1</td><td style="text-align:right">{fmt(report.get('foodpanda1_sales',0))}</td></tr>
      <tr style="color:#5C5F5C"><td style="padding:4px 0 4px 16px">FoodPanda 2</td><td style="text-align:right">{fmt(report.get('foodpanda2_sales',0))}</td></tr>
      <tr><td colspan="2" style="border-top:1px solid #E5E2DC;padding:6px 0"></td></tr>
      <tr><td style="padding:4px 0">Total Orders</td><td style="text-align:right">{report.get('total_orders',0)}</td></tr>
      <tr><td style="padding:4px 0">Items Sold</td><td style="text-align:right">{report.get('total_items_sold',0)}</td></tr>
      <tr><td style="padding:4px 0;color:#A63D31">Expenses</td><td style="text-align:right;color:#A63D31">{fmt(report.get('total_expenses',0))}</td></tr>
      <tr><td style="padding:4px 0;color:#A63D31">Refunds</td><td style="text-align:right;color:#A63D31">{fmt(report.get('total_refunds',0))}</td></tr>
      <tr><td style="padding:8px 0;font-weight:bold;color:#1E3F20">Net Revenue</td><td style="text-align:right;font-weight:bold;color:#1E3F20">{fmt(report.get('net_revenue',0))}</td></tr>
    </table>
    <h3 style="margin:24px 0 8px;color:#1E3F20">Top Items</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #E5E2DC">
      <thead style="background:#F9F8F6"><tr><th style="text-align:left;padding:6px 12px">Item</th><th style="text-align:right;padding:6px 12px">Qty</th></tr></thead>
      <tbody>{rows_html or '<tr><td colspan=2 style="padding:12px;color:#5C5F5C">No items</td></tr>'}</tbody>
    </table>
  </div>
  <div style="padding:12px 24px;background:#F9F8F6;border-top:1px solid #E5E2DC;font-size:12px;color:#5C5F5C">Sent automatically by RestoPOS</div>
</div></body></html>"""
    return subject, plain, html


def _send_email_sync(host, port, user, password, use_tls, sender, to_list, subject, plain, html):
    """Synchronous SMTP send. Raises on error."""
    msg = EmailMessage()
    msg["From"] = sender or user
    msg["To"] = ", ".join(to_list)
    msg["Subject"] = subject
    msg.set_content(plain)
    if html:
        msg.add_alternative(html, subtype="html")

    if int(port) == 465:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, int(port), context=ctx, timeout=20) as s:
            if user and password:
                s.login(user, password)
            s.send_message(msg)
    else:
        with smtplib.SMTP(host, int(port), timeout=20) as s:
            s.ehlo()
            if use_tls:
                s.starttls(context=ssl.create_default_context())
                s.ehlo()
            if user and password:
                s.login(user, password)
            s.send_message(msg)


async def _get_settings_doc() -> dict:
    s = await db.settings.find_one({"key": "global"}, {"_id": 0}) or {}
    return {k: s.get(k, v) for k, v in DEFAULT_SETTINGS.items()}


def _validate_smtp(s: dict):
    if not s.get("smtp_host"): raise HTTPException(status_code=400, detail="SMTP host not configured. Go to Settings → Email.")
    if not s.get("smtp_port"): raise HTTPException(status_code=400, detail="SMTP port not configured.")
    if not (s.get("smtp_user") and s.get("smtp_password")):
        raise HTTPException(status_code=400, detail="SMTP username/password not configured.")


def _filter_recipients(recipients: list, report_type: str) -> list:
    """Pick recipients who opted-in for the given report type. report_type is 'X' or 'Z'."""
    out = []
    key = "receive_x" if report_type.upper() == "X" else "receive_z"
    for r in (recipients or []):
        if not r.get("email"): continue
        # Default to True if flag missing
        if r.get(key, True):
            out.append(r["email"])
    return out


@api_router.post("/email/test")
async def email_test(request: Request, body: Dict[str, Any] = None):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    _validate_smtp(s)
    body = body or {}
    to = body.get("to") or s.get("smtp_user")
    if not to: raise HTTPException(status_code=400, detail="No recipient address")
    subject = f"[{s.get('restaurant_name','RestoPOS')}] Test Email"
    plain = "If you received this, your SMTP configuration is working correctly."
    html = f"<p>If you received this, your <b>SMTP configuration</b> is working correctly.</p><p style='color:#5C5F5C'>From: {s.get('restaurant_name','RestoPOS')}</p>"
    try:
        await asyncio.to_thread(_send_email_sync, s["smtp_host"], s["smtp_port"], s.get("smtp_user",""), s.get("smtp_password",""), bool(s.get("smtp_use_tls", True)), s.get("smtp_from") or s.get("smtp_user"), [to], subject, plain, html)
    except Exception as e:
        logger.error(f"SMTP test failed: {e}")
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)[:200]}")
    return {"message": f"Test email sent to {to}"}


@api_router.post("/email/send-report")
async def email_send_report(request: Request, body: Dict[str, Any]):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    _validate_smtp(s)

    report_type = (body.get("report_type") or "X").upper()
    report_id_date = body.get("date")  # optional: pick a specific archived Z-report
    extra_to = body.get("extra_recipients") or []

    # Get the report data
    if report_id_date:
        rep = await db.z_reports.find_one({"date": report_id_date}, {"_id": 0})
        if not rep: raise HTTPException(status_code=404, detail="Report not found")
        rep["report_type"] = "Z"
    else:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        orders = await db.orders.find({"date": today}).to_list(10000)
        expenses = await db.expenses.find({"date": today}).to_list(500)
        refunds = await db.refunds.find({"date": today}).to_list(500)
        rep = calc_report(orders, expenses, refunds)
        rep.update({"date": today, "report_type": report_type})

    # Build recipients list
    cfg_recipients = _filter_recipients(s.get("email_recipients", []), rep.get("report_type", "X"))
    recipients = list(dict.fromkeys([*cfg_recipients, *[e for e in extra_to if e]]))
    if not recipients:
        raise HTTPException(status_code=400, detail="No recipients configured. Add at least one in Settings → Email.")

    subject, plain, html = _format_report_email(rep, s)
    try:
        await asyncio.to_thread(_send_email_sync, s["smtp_host"], s["smtp_port"], s.get("smtp_user",""), s.get("smtp_password",""), bool(s.get("smtp_use_tls", True)), s.get("smtp_from") or s.get("smtp_user"), recipients, subject, plain, html)
    except Exception as e:
        logger.error(f"SMTP send failed: {e}")
        raise HTTPException(status_code=500, detail=f"SMTP error: {str(e)[:200]}")
    return {"message": f"Report sent to {len(recipients)} recipient(s)", "recipients": recipients}


# --- WhatsApp (proxy to local Node service) ---
def _format_report_whatsapp(report: dict, settings: dict) -> str:
    rname = settings.get("restaurant_name", "RestoPOS")
    cur = settings.get("currency", "Rs")
    rtype = report.get("report_type", "X")
    date = report.get("date", "")

    def fmt(v):
        try: return f"{cur} {float(v):,.2f}"
        except: return f"{cur} 0.00"

    lines = [
        f"*{rname}*",
        f"*{rtype}-Report — {date}*",
        "",
        f"💰 Total Sales: *{fmt(report.get('total_sales', 0))}*",
        f"   • Cash: {fmt(report.get('cash_sales', 0))}",
        f"   • Card: {fmt(report.get('credit_sales', 0))}",
        f"   • FoodPanda 1: {fmt(report.get('foodpanda1_sales', 0))}",
        f"   • FoodPanda 2: {fmt(report.get('foodpanda2_sales', 0))}",
        "",
        f"🛒 Orders: {report.get('total_orders', 0)}",
        f"📦 Items Sold: {report.get('total_items_sold', 0)}",
        f"💸 Expenses: {fmt(report.get('total_expenses', 0))}",
        f"↩️ Refunds: {fmt(report.get('total_refunds', 0))}",
        f"📈 *Net Revenue: {fmt(report.get('net_revenue', 0))}*",
    ]
    top = report.get("top_items") or []
    if top:
        lines += ["", "*Top Items:*"]
        for ti in top[:5]:
            lines.append(f"  • {ti.get('name')} × {ti.get('quantity')}")
    lines += ["", "_Sent automatically by RestoPOS_"]
    return "\n".join(lines)


def _filter_whatsapp_recipients(recipients: list, report_type: str) -> list:
    out = []
    key = "receive_x" if report_type.upper() == "X" else "receive_z"
    for r in (recipients or []):
        if not r.get("phone"): continue
        if r.get(key, True):
            out.append({"name": r.get("name", ""), "phone": r["phone"]})
    return out


async def _wa_get(path: str, settings: dict, timeout: float = 10.0):
    url = (settings.get("whatsapp_service_url") or "http://127.0.0.1:3030").rstrip("/")
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.get(f"{url}{path}")
        return r


async def _wa_post(path: str, payload: dict, settings: dict, timeout: float = 30.0):
    url = (settings.get("whatsapp_service_url") or "http://127.0.0.1:3030").rstrip("/")
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(f"{url}{path}", json=payload)
        return r


@api_router.get("/whatsapp/status")
async def whatsapp_status(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    try:
        r = await _wa_get("/status", s, timeout=5.0)
        return r.json()
    except Exception as e:
        return {"ready": False, "phone": None, "qr_available": False, "error": f"Service not reachable: {str(e)[:160]}"}


@api_router.get("/whatsapp/qr")
async def whatsapp_qr(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    try:
        r = await _wa_get("/qr", s, timeout=5.0)
        if r.status_code == 404: return {"qr": None, "ready": False, "message": "QR not yet generated"}
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"WhatsApp service not reachable: {str(e)[:160]}")


@api_router.post("/whatsapp/reset")
async def whatsapp_reset(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    try:
        r = await _wa_post("/reset", {}, s, timeout=15.0)
        return r.json()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"WhatsApp service not reachable: {str(e)[:160]}")


@api_router.post("/whatsapp/test")
async def whatsapp_test(request: Request, body: Dict[str, Any]):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    to = (body or {}).get("to")
    if not to: raise HTTPException(status_code=400, detail="Phone number required (e.g., +923004928411)")
    msg = (body or {}).get("message") or f"Test message from {s.get('restaurant_name','RestoPOS')}. If you got this, WhatsApp integration is working ✅"
    try:
        r = await _wa_post("/send", {"to": to, "message": msg}, s, timeout=20.0)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"WhatsApp service not reachable: {str(e)[:160]}")
    if r.status_code >= 400:
        try: detail = r.json().get("error", "Failed")
        except: detail = "Failed"
        raise HTTPException(status_code=r.status_code, detail=detail)
    return {"message": f"Test message sent to {to}"}


@api_router.post("/whatsapp/send-report")
async def whatsapp_send_report(request: Request, body: Dict[str, Any]):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()

    report_type = (body.get("report_type") or "X").upper()
    report_id_date = body.get("date")
    extra_to = body.get("extra_recipients") or []  # list of phone strings

    if report_id_date:
        rep = await db.z_reports.find_one({"date": report_id_date}, {"_id": 0})
        if not rep: raise HTTPException(status_code=404, detail="Report not found")
        rep["report_type"] = "Z"
    else:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        orders = await db.orders.find({"date": today}).to_list(10000)
        expenses = await db.expenses.find({"date": today}).to_list(500)
        refunds = await db.refunds.find({"date": today}).to_list(500)
        rep = calc_report(orders, expenses, refunds)
        rep.update({"date": today, "report_type": report_type})

    cfg_recipients = _filter_whatsapp_recipients(s.get("whatsapp_recipients", []), rep.get("report_type", "X"))
    phones = list(dict.fromkeys([*[r["phone"] for r in cfg_recipients], *[p for p in extra_to if p]]))
    if not phones:
        raise HTTPException(status_code=400, detail="No WhatsApp recipients configured. Add at least one in Settings → WhatsApp.")

    message = _format_report_whatsapp(rep, s)
    sent_to, failed = [], []
    for phone in phones:
        try:
            r = await _wa_post("/send", {"to": phone, "message": message}, s, timeout=30.0)
            if r.status_code < 400:
                sent_to.append(phone)
            else:
                try: err = r.json().get("error", f"HTTP {r.status_code}")
                except: err = f"HTTP {r.status_code}"
                failed.append({"phone": phone, "error": err})
        except Exception as e:
            failed.append({"phone": phone, "error": f"Service unreachable: {str(e)[:120]}"})

    if not sent_to and failed:
        raise HTTPException(status_code=502, detail={"message": "All sends failed", "failed": failed})
    return {"message": f"Sent to {len(sent_to)} recipient(s)", "sent_to": sent_to, "failed": failed}


# --- Daily Auto-Send Scheduler ---
scheduler: Optional[AsyncIOScheduler] = None


async def _build_report_for_scheduler(s: dict) -> dict:
    """Generate the report to send. Default is yesterday's data."""
    use_yesterday = (s.get("daily_report_type") or "yesterday").lower() == "yesterday"
    target = (datetime.now(timezone.utc) - timedelta(days=1)) if use_yesterday else datetime.now(timezone.utc)
    target_date = target.strftime("%Y-%m-%d")

    # Prefer archived Z report if it exists for that date
    z_archived = await db.z_reports.find_one({"date": target_date}, {"_id": 0})
    if z_archived:
        z_archived["report_type"] = "Z"
        return z_archived

    orders = await db.orders.find({"date": target_date}).to_list(10000)
    expenses = await db.expenses.find({"date": target_date}).to_list(500)
    refunds = await db.refunds.find({"date": target_date}).to_list(500)
    r = calc_report(orders, expenses, refunds)
    r.update({"date": target_date, "report_type": "Z" if use_yesterday else "X"})
    return r


async def _send_whatsapp_to_recipients(rep: dict, s: dict):
    cfg = _filter_whatsapp_recipients(s.get("whatsapp_recipients", []), rep.get("report_type", "Z"))
    if not cfg: return {"sent": 0, "failed": 0}
    msg = _format_report_whatsapp(rep, s)
    sent, failed = 0, 0
    for r in cfg:
        try:
            resp = await _wa_post("/send", {"to": r["phone"], "message": msg}, s, timeout=30.0)
            if resp.status_code < 400: sent += 1
            else: failed += 1
        except Exception:
            failed += 1
    return {"sent": sent, "failed": failed}


async def _send_email_to_recipients(rep: dict, s: dict):
    cfg = _filter_recipients(s.get("email_recipients", []), rep.get("report_type", "Z"))
    if not cfg: return {"sent": 0, "skipped": True}
    if not (s.get("smtp_host") and s.get("smtp_user") and s.get("smtp_password")):
        return {"sent": 0, "skipped": True, "reason": "SMTP not configured"}
    subject, plain, html = _format_report_email(rep, s)
    try:
        await asyncio.to_thread(_send_email_sync, s["smtp_host"], s["smtp_port"], s.get("smtp_user",""), s.get("smtp_password",""), bool(s.get("smtp_use_tls", True)), s.get("smtp_from") or s.get("smtp_user"), cfg, subject, plain, html)
        return {"sent": len(cfg)}
    except Exception as e:
        logger.error(f"Scheduled email send failed: {e}")
        return {"sent": 0, "error": str(e)[:200]}


async def daily_report_job():
    """Runs at the configured time. Sends yesterday's (or today's) report via email & WhatsApp if enabled."""
    try:
        s = await _get_settings_doc()
        if not (s.get("auto_email_daily") or s.get("auto_whatsapp_daily")):
            logger.info("Daily report job: both email & whatsapp auto-send are off; skipping")
            return
        rep = await _build_report_for_scheduler(s)
        results = {"email": None, "whatsapp": None}
        if s.get("auto_email_daily"):
            results["email"] = await _send_email_to_recipients(rep, s)
        if s.get("auto_whatsapp_daily"):
            results["whatsapp"] = await _send_whatsapp_to_recipients(rep, s)
        # Log a summary record
        await db.scheduled_runs.insert_one({
            "ran_at": datetime.now(timezone.utc).isoformat(),
            "report_date": rep.get("date"),
            "report_type": rep.get("report_type"),
            "results": results,
        })
        logger.info(f"Daily report job complete: {results}")
    except Exception as e:
        logger.exception(f"Daily report job error: {e}")


async def _reschedule_daily_job():
    global scheduler
    if scheduler is None: return
    s = await _get_settings_doc()
    time_str = s.get("daily_report_time") or "02:15"
    tz_name = s.get("daily_report_timezone") or "Asia/Karachi"
    try:
        hh, mm = [int(x) for x in time_str.split(":")[:2]]
        tz = pytz.timezone(tz_name)
    except Exception as e:
        logger.error(f"Invalid schedule time/tz '{time_str}' / '{tz_name}': {e}")
        return
    # Replace existing job
    try: scheduler.remove_job("daily_report")
    except Exception: pass
    scheduler.add_job(daily_report_job, CronTrigger(hour=hh, minute=mm, timezone=tz), id="daily_report", replace_existing=True, misfire_grace_time=3600)
    logger.info(f"Daily report scheduled for {hh:02d}:{mm:02d} {tz_name}")


@api_router.get("/schedule/status")
async def schedule_status(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    info = {"daily_report_time": s.get("daily_report_time"), "daily_report_timezone": s.get("daily_report_timezone"), "auto_email_daily": bool(s.get("auto_email_daily")), "auto_whatsapp_daily": bool(s.get("auto_whatsapp_daily")), "daily_report_type": s.get("daily_report_type"), "next_run": None}
    if scheduler is not None:
        try:
            j = scheduler.get_job("daily_report")
            if j and j.next_run_time:
                info["next_run"] = j.next_run_time.isoformat()
        except Exception: pass
    return info


@api_router.post("/schedule/run-now")
async def schedule_run_now(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    asyncio.create_task(daily_report_job())
    return {"message": "Daily report job triggered. Check logs."}


@api_router.get("/schedule/timezones")
async def list_timezones(request: Request):
    await get_current_user(request)
    # A curated short list — full pytz list is too large for a dropdown
    return [
        "Asia/Karachi", "Asia/Dubai", "Asia/Riyadh", "Asia/Kolkata", "Asia/Dhaka",
        "Asia/Singapore", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul",
        "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Istanbul",
        "Africa/Cairo", "Africa/Johannesburg",
        "America/New_York", "America/Chicago", "America/Los_Angeles", "America/Toronto",
        "America/Sao_Paulo",
        "Australia/Sydney", "Pacific/Auckland",
        "UTC",
    ]


# --- Cloudflare Tunnel ---
import re as _re
_TUNNEL_URL_RE = _re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def _resolve_tunnel_log_path(custom: str = "") -> str:
    if custom and os.path.exists(custom):
        return custom
    # default candidates relative to project root
    root = ROOT_DIR.parent
    for name in ("cloudflared.log", "tunnel.log", "windows-setup/cloudflared.log"):
        p = root / name
        if p.exists():
            return str(p)
    return ""


def _read_tunnel_url_from_log(path: str) -> Optional[str]:
    """Find the most recent trycloudflare.com URL in the log file."""
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            # Read tail (last 64 KB is plenty)
            try:
                f.seek(0, 2); size = f.tell(); f.seek(max(0, size - 65536))
            except Exception:
                pass
            content = f.read()
        matches = _TUNNEL_URL_RE.findall(content)
        return matches[-1] if matches else None
    except Exception:
        return None


async def _maybe_notify_tunnel_url_change(new_url: str):
    """Email and WhatsApp the new tunnel URL to recipients (if enabled)."""
    try:
        s = await _get_settings_doc()
        if not s.get("tunnel_notify_on_change"): return
        rname = s.get("restaurant_name", "RestoPOS")
        msg_text = f"RestoPOS is online.\n\nRemote access URL:\n{new_url}\n\nLogin: {s.get('restaurant_email','admin@restaurant.com')} / your password\n\n— {rname}"
        msg_html = f"""<div style="font-family:Arial,sans-serif"><h2 style="color:#1E3F20">{rname} is online</h2><p>You can now access your POS from anywhere using:</p><p style="margin:16px 0"><a href="{new_url}" style="background:#1E3F20;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold">{new_url}</a></p><p style="color:#5C5F5C;font-size:13px">Login with the same admin email/password you use locally. This URL changes every time the Pakistan PC restarts.</p></div>"""
        # Email
        if s.get("smtp_host") and s.get("smtp_user") and s.get("smtp_password"):
            email_to = [r["email"] for r in (s.get("email_recipients") or []) if r.get("email")]
            if email_to:
                try:
                    await asyncio.to_thread(_send_email_sync, s["smtp_host"], s["smtp_port"], s.get("smtp_user",""), s.get("smtp_password",""), bool(s.get("smtp_use_tls", True)), s.get("smtp_from") or s.get("smtp_user"), email_to, f"[{rname}] Remote access URL", msg_text, msg_html)
                    logger.info(f"Notified email recipients of new tunnel URL: {new_url}")
                except Exception as e: logger.error(f"Tunnel notify email failed: {e}")
        # WhatsApp
        wa_to = [r["phone"] for r in (s.get("whatsapp_recipients") or []) if r.get("phone")]
        if wa_to:
            for phone in wa_to:
                try:
                    await _wa_post("/send", {"to": phone, "message": msg_text}, s, timeout=20.0)
                except Exception: pass
            logger.info(f"Notified WhatsApp recipients of new tunnel URL: {new_url}")
    except Exception as e:
        logger.exception(f"Tunnel notify failed: {e}")


async def tunnel_watcher_loop():
    """Background task: periodically reads cloudflared log and updates tunnel URL in DB."""
    last_seen = None
    while True:
        try:
            s = await _get_settings_doc()
            log_path = _resolve_tunnel_log_path(s.get("tunnel_log_path") or "")
            if log_path:
                url = _read_tunnel_url_from_log(log_path)
                if url and url != last_seen:
                    await db.tunnel.update_one({"key": "current"}, {"$set": {"url": url, "updated_at": datetime.now(timezone.utc).isoformat(), "log_path": log_path}}, upsert=True)
                    # always notify on change (including first detection after restart)
                    await _maybe_notify_tunnel_url_change(url)
                    logger.info(f"Tunnel URL updated: {url}")
                    last_seen = url
        except Exception as e:
            logger.error(f"Tunnel watcher error: {e}")
        await asyncio.sleep(15)


@api_router.get("/tunnel/status")
async def get_tunnel_status(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    log_path = _resolve_tunnel_log_path(s.get("tunnel_log_path") or "")
    cur = await db.tunnel.find_one({"key": "current"}, {"_id": 0}) or {}
    return {
        "url": cur.get("url"),
        "updated_at": cur.get("updated_at"),
        "log_path": log_path or s.get("tunnel_log_path") or "",
        "log_exists": bool(log_path),
        "notify_on_change": bool(s.get("tunnel_notify_on_change", True)),
    }


@api_router.post("/tunnel/refresh")
async def refresh_tunnel(request: Request):
    """Force a re-read of the tunnel log."""
    user = await get_current_user(request)
    if user.get("role") != "admin": raise HTTPException(status_code=403, detail="Admin only")
    s = await _get_settings_doc()
    log_path = _resolve_tunnel_log_path(s.get("tunnel_log_path") or "")
    if not log_path: return {"url": None, "message": "No log file found yet"}
    url = _read_tunnel_url_from_log(log_path)
    if url:
        await db.tunnel.update_one({"key": "current"}, {"$set": {"url": url, "updated_at": datetime.now(timezone.utc).isoformat(), "log_path": log_path}}, upsert=True)
    return {"url": url, "log_path": log_path}


# --- Dashboard ---
@api_router.get("/dashboard/stats")
async def get_dashboard_stats(request: Request, date: Optional[str] = None):
    await get_current_user(request)
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    # Check if day was closed
    z_closed = await db.z_reports.find_one({"date": target_date})
    is_closed = z_closed is not None
    orders = await db.orders.find({"date": target_date}).to_list(10000)
    expenses = await db.expenses.find({"date": target_date}).to_list(500)
    refunds = await db.refunds.find({"date": target_date}).to_list(500)
    r = calc_report(orders, expenses, refunds)
    low_stock = await db.menu_items.aggregate([{"$match": {"$expr": {"$lte": ["$stock", "$low_stock_threshold"]}}}]).to_list(500)
    r.update({"today": target_date, "is_closed": is_closed, "low_stock_count": len(low_stock), "total_menu_items": await db.menu_items.count_documents({}), "total_categories": await db.categories.count_documents({})})
    return r

@api_router.get("/dashboard/hourly-sales")
async def get_hourly_sales(request: Request, date: Optional[str] = None):
    await get_current_user(request)
    target_date = date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    orders = await db.orders.find({"date": target_date}).to_list(10000)
    hourly = {f"{h:02d}:00": {"hour": f"{h:02d}:00", "cash": 0.0, "credit": 0.0, "online": 0.0, "total": 0.0, "orders": 0} for h in range(24)}
    for o in orders:
        try:
            ts = datetime.fromisoformat(o["created_at"])
            label = f"{ts.hour:02d}:00"
            amt = o.get("total", 0)
            hourly[label]["total"] = round(hourly[label]["total"] + amt, 2)
            hourly[label]["orders"] += 1
            pt = o.get("payment_type", "cash")
            if pt == "cash": hourly[label]["cash"] = round(hourly[label]["cash"] + amt, 2)
            elif pt == "credit": hourly[label]["credit"] = round(hourly[label]["credit"] + amt, 2)
            else: hourly[label]["online"] = round(hourly[label]["online"] + amt, 2)
        except: pass
    return list(hourly.values())

# --- Data Management (Admin) ---
@api_router.get("/data/export")
async def export_all_data(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    data = {"_meta": {"exported_at": datetime.now(timezone.utc).isoformat(), "version": 2}}
    # Include users (for password) and settings (for SMTP/WhatsApp/Schedule config)
    for col_name in ["users", "settings", "categories", "menu_items", "vendors", "orders", "z_reports", "expenses", "vendor_transactions", "vendor_payments", "refunds"]:
        col = db[col_name]
        docs = await col.find({}).to_list(100000)
        data[col_name] = [
            {k: (str(v) if k == "_id" else v) for k, v in d.items()}
            for d in docs
        ]
    return data

@api_router.get("/data/stats")
async def get_data_stats(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    stats = {}
    for col_name in ["orders", "z_reports", "expenses", "vendor_transactions", "vendor_payments", "refunds"]:
        stats[col_name] = await db[col_name].count_documents({})
    return stats

class DataDeleteRequest(BaseModel):
    before_date: str
    collections: List[str]

@api_router.post("/data/delete")
async def delete_old_data(req: DataDeleteRequest, request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    deleted = {}
    for col_name in req.collections:
        if col_name in ["orders", "z_reports", "expenses", "vendor_transactions", "vendor_payments"]:
            result = await db[col_name].delete_many({"date": {"$lt": req.before_date}})
            deleted[col_name] = result.deleted_count
    return {"message": "Data deleted", "deleted": deleted}

@api_router.post("/data/import")
async def import_data(request: Request):
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    body = await request.json()
    imported = {}
    # Replace mode: wipe target collections and reinsert with original IDs preserved
    # so cross-collection refs (menu_item.category_id, vendor_transaction.vendor_id) stay valid.
    allowed = ["users", "settings", "categories", "menu_items", "vendors", "orders", "z_reports", "expenses", "vendor_transactions", "vendor_payments", "refunds"]
    for col_name in allowed:
        if col_name in body and isinstance(body[col_name], list):
            await db[col_name].delete_many({})  # clear existing
            docs = []
            for d in body[col_name]:
                doc = {k: v for k, v in d.items() if k != "_meta"}
                # Convert string _id back to ObjectId to preserve cross-collection refs
                if "_id" in doc and isinstance(doc["_id"], str):
                    try: doc["_id"] = ObjectId(doc["_id"])
                    except Exception: doc.pop("_id", None)  # invalid → let mongo assign new
                docs.append(doc)
            if docs:
                try:
                    result = await db[col_name].insert_many(docs, ordered=False)
                    imported[col_name] = len(result.inserted_ids)
                except Exception as e:
                    logger.error(f"Import {col_name} failed: {e}")
                    imported[col_name] = f"failed: {str(e)[:100]}"
            else:
                imported[col_name] = 0
    return {"message": "Data imported (existing data was replaced)", "imported": imported}

# --- Cleanup & Seed ---
async def cleanup_old_data():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).strftime("%Y-%m-%d")
    await db.orders.delete_many({"date": {"$lt": cutoff}})
    await db.z_reports.delete_many({"date": {"$lt": cutoff}})
    await db.expenses.delete_many({"date": {"$lt": cutoff}})
    logger.info(f"Cleaned up data older than {cutoff}")

async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@restaurant.com").lower().strip()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({"email": admin_email, "password_hash": hash_password(admin_password), "name": "Admin", "role": "admin", "permissions": ADMIN_PERMISSIONS, "created_at": datetime.now(timezone.utc).isoformat()})
        logger.info(f"Admin created: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
    # Ensure admin has permissions field
    if existing and "permissions" not in existing:
        await db.users.update_one({"email": admin_email}, {"$set": {"permissions": ADMIN_PERMISSIONS}})
    # Seed default settings
    if not await db.settings.find_one({"key": "global"}):
        await db.settings.insert_one({"key": "global", **DEFAULT_SETTINGS})
    # Write test credentials (safe for both cloud and local)
    try:
        memory_dir = ROOT_DIR.parent / "memory"
        memory_dir.mkdir(exist_ok=True)
        with open(memory_dir / "test_credentials.md", "w") as f:
            f.write(f"# Test Credentials\n\n## Admin\n- Email: {admin_email}\n- Password: {admin_password}\n- Role: admin\n")
    except Exception:
        pass

@app.on_event("startup")
async def startup():
    global scheduler
    await db.users.create_index("email", unique=True)
    # Performance indexes – critical as data grows.
    # Skip silently if they already exist or the collection is empty.
    try:
        await db.orders.create_index([("date", -1), ("created_at", -1)])
        await db.orders.create_index("payment_type")
        await db.orders.create_index([("created_at", -1)])
        await db.menu_items.create_index([("sort_order", 1), ("created_at", 1)])
        await db.categories.create_index([("sort_order", 1), ("created_at", 1)])
        await db.expenses.create_index([("date", -1)])
        await db.refunds.create_index([("date", -1)])
        await db.z_reports.create_index([("date", -1)])
    except Exception as e:
        logger.warning(f"Index creation skipped: {e}")
    await seed_admin()
    await cleanup_old_data()
    # Start the scheduler
    try:
        scheduler = AsyncIOScheduler()
        scheduler.start()
        await _reschedule_daily_job()
    except Exception as e:
        logger.error(f"Scheduler start failed: {e}")
    # Start tunnel watcher in background
    try:
        asyncio.create_task(tunnel_watcher_loop())
    except Exception as e:
        logger.error(f"Tunnel watcher start failed: {e}")
    logger.info("Restaurant POS started")

@app.on_event("shutdown")
async def shutdown_db_client():
    global scheduler
    try:
        if scheduler:
            scheduler.shutdown(wait=False)
    except Exception: pass
    client.close()

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- Serve built frontend (production / local Windows install) ---
# When `frontend/build` exists, serve it from the backend at "/".
# This gives single-origin (no CORS, no proxy needed), fast load (no dev
# compilation), and makes Cloudflare tunneling trivial (one port).
# Skipped automatically in dev environments where build doesn't exist.
try:
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import FileResponse
    _frontend_build = ROOT_DIR.parent / "frontend" / "build"
    if _frontend_build.exists() and (_frontend_build / "index.html").exists():
        # Static assets (JS/CSS/images)
        app.mount("/static", StaticFiles(directory=str(_frontend_build / "static")), name="static")

        @app.get("/{full_path:path}")
        async def spa_fallback(full_path: str):
            # API routes are handled by api_router (mounted earlier).
            # Anything else returns index.html so React Router can take over.
            if full_path.startswith("api/"):
                raise HTTPException(status_code=404, detail="API route not found")
            asset = _frontend_build / full_path
            if asset.is_file():
                return FileResponse(str(asset))
            return FileResponse(str(_frontend_build / "index.html"))
        logger.info(f"Serving built frontend from: {_frontend_build}")
except Exception as e:
    logger.warning(f"Frontend static serve disabled: {e}")

