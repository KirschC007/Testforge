# LogisticsHub API — Spezifikation v2.0

## Überblick
Multi-Tenant-Plattform für Logistik und Lagerverwaltung. Jedes Unternehmen (`companyId`) ist isoliert.
Unternehmen verwalten Lager, Waren, Bestellungen, Lieferungen und Retouren.

Alle Geldbeträge in EUR-Cent (Integer). Gewichte in Gramm (Integer).

## Authentifizierung
- POST /api/auth/login → JWT + Session-Cookie
- GET /api/auth/csrf-token → CSRF Double-Submit-Cookie
- JWT enthält: `userId`, `companyId`, `role`, `warehouseId` (nullable)
- Rate-Limit: 5 Fehlversuche pro 15 Minuten → 429, dann 30-Minuten-Sperre

## Rollen & Berechtigungen

| Berechtigung | warehouse_worker | warehouse_manager | logistics_coordinator | finance | company_admin |
|---|---|---|---|---|---|
| Waren annehmen | ✅ eigenes Lager | ✅ eigenes Lager | ❌ | ❌ | ✅ |
| Bestand einsehen | eigenes Lager | eigenes Lager | alle Lager | ❌ | alle |
| Bestellung erstellen | ❌ | ❌ | ✅ | ❌ | ✅ |
| Lieferung erstellen | ❌ | ✅ eigenes Lager | ✅ | ❌ | ✅ |
| Lieferung verfolgen | eigenes Lager | eigenes Lager | alle | alle | alle |
| Retoure erstellen | ❌ | ✅ eigenes Lager | ✅ | ❌ | ✅ |
| Rechnung erstellen | ❌ | ❌ | ❌ | ✅ | ✅ |
| Zahlung buchen | ❌ | ❌ | ❌ | ✅ | ✅ |
| Berichte einsehen | ❌ | eigenes Lager | alle | alle | alle |
| DSGVO-Export/Löschung | ❌ | ❌ | ❌ | ❌ | ✅ |

## Endpunkte

### POST /api/products
Produkt anlegen.
Input: `companyId` (number), `sku` (string, min:3, max:30, unique per company), `name` (string, min:2, max:200), `description` (string, max:5000, optional), `category` (enum: ELECTRONICS|CLOTHING|FOOD|PHARMA|HAZMAT|FURNITURE|RAW_MATERIAL), `weight` (number, grams, min:1, max:50000000), `dimensions` (object: {length: number, width: number, height: number}, cm, optional), `storageRequirements` (enum: STANDARD|REFRIGERATED|FROZEN|HAZMAT_CERTIFIED, default:STANDARD), `reorderPoint` (number, min:0, default:10), `unitPrice` (number, cents, min:1, max:99999999)
Auth: logistics_coordinator, company_admin
- sku muss innerhalb des Unternehmens eindeutig sein → 409 SKU_EXISTS
- companyId muss mit JWT übereinstimmen → 403 COMPANY_MISMATCH

### GET /api/products
Produkte auflisten.
Input: `companyId`, `category` (optional), `belowReorderPoint` (boolean, optional), `search` (string, optional)
Auth: warehouse_worker, warehouse_manager, logistics_coordinator, company_admin

### POST /api/inventory/receive
Wareneingang buchen.
Input: `companyId` (number), `warehouseId` (number), `items` (array min:1 max:100 of: { `sku` (string), `quantity` (number, min:1, max:99999), `lotNumber` (string, max:50, optional), `expiryDate` (date, optional, must be future for FOOD/PHARMA) }), `deliveryNote` (string, max:200, optional), `supplierId` (number, optional)
Auth: warehouse_worker, warehouse_manager (eigenes Lager), company_admin
- warehouseId muss dem User zugeordnet sein (Worker/Manager) → 403 WAREHOUSE_MISMATCH
- Für FOOD/PHARMA: expiryDate Pflicht → 400 EXPIRY_REQUIRED
- Lagerkapazität darf nicht überschritten werden → 422 WAREHOUSE_FULL
- Side-effects: inventory.quantity += quantity, Bestandsbewegung geloggt

### GET /api/inventory
Bestand einsehen.
Input: `companyId`, `warehouseId` (optional für Coordinator/Admin), `sku` (optional), `belowReorderPoint` (boolean, optional), `expired` (boolean, optional)
Auth: rollenbasiertes Filtering (siehe Tabelle)

### POST /api/orders
Bestellung erstellen.
Input: `companyId` (number), `customerId` (number), `items` (array min:1 max:200 of: { `sku` (string), `quantity` (number, min:1), `unitPrice` (number, cents) }), `shippingAddress` (object: { street: string min:5 max:200, city: string min:2 max:100, zip: string min:4 max:10, country: string 2-letter ISO }), `priority` (enum: STANDARD|EXPRESS|OVERNIGHT, default:STANDARD), `notes` (string, max:2000, optional)
Auth: logistics_coordinator, company_admin
- Alle SKUs müssen existieren → 404 PRODUCT_NOT_FOUND
- Bestand muss ausreichend sein (Summe über alle Lager) → 422 INSUFFICIENT_STOCK
- Gleichzeitige Bestellungen auf denselben Bestand: genau eine gewinnt → INSUFFICIENT_STOCK
- Side-effects: Bestand reserviert (status: RESERVED)

### GET /api/orders
Bestellungen auflisten.
Input: `companyId`, `status` (optional), `customerId` (optional), `dateFrom`/`dateTo` (optional)
Auth: rollenbasiertes Filtering

### PATCH /api/orders/:id/status
Bestellstatus ändern.
Input: `status` (enum), `note` (string, min:5, max:2000, Pflicht bei CANCELLED/ON_HOLD)
Auth: abhängig von Transition (siehe Status-Machine)

### POST /api/shipments
Lieferung erstellen.
Input: `companyId` (number), `orderId` (number), `warehouseId` (number — Ursprungslager), `trackingNumber` (string, min:5, max:100, unique per company), `carrier` (string, min:2, max:100), `packages` (array min:1 max:50 of: { `weight` (number, grams), `dimensions` (string), `items` (array of: { `sku`, `quantity` }) }), `estimatedDelivery` (date, must be future)
Auth: warehouse_manager (eigenes Lager), logistics_coordinator, company_admin
- Order muss im Status CONFIRMED sein → 422 ORDER_NOT_CONFIRMED
- trackingNumber muss eindeutig sein → 409 TRACKING_EXISTS
- Alle items müssen im Ursprungslager vorhanden sein → 422 ITEM_NOT_IN_WAREHOUSE
- Side-effects: order.status → SHIPPED, inventory -= shipped quantities

### PATCH /api/shipments/:id/status
Lieferstatus aktualisieren.
Input: `status` (enum), `location` (string, max:200, optional), `note` (string, max:2000, optional)
Auth: warehouse_manager, logistics_coordinator, company_admin

### POST /api/returns
Retoure erstellen.
Input: `companyId` (number), `orderId` (number), `items` (array min:1 of: { `sku`, `quantity` (number, min:1), `reason` (enum: DAMAGED|WRONG_ITEM|DEFECTIVE|CUSTOMER_RETURN|RECALL), `condition` (enum: SELLABLE|DAMAGED|DESTROYED) }), `returnShipmentTracking` (string, max:100, optional)
Auth: warehouse_manager, logistics_coordinator, company_admin
- Order muss DELIVERED sein → 422 ORDER_NOT_DELIVERED
- Retournierte Menge darf Bestellmenge nicht überschreiten → 400 QUANTITY_EXCEEDS_ORDER
- Pro Order max 1 Retoure → 409 RETURN_EXISTS
- Side-effects: wenn condition=SELLABLE → inventory += quantity, order.status → PARTIALLY_RETURNED oder FULLY_RETURNED

### POST /api/invoices
Rechnung erstellen.
Input: `companyId` (number), `orderId` (number), `lineItems` (array min:1 max:200 of: { `description` (string, min:5, max:200), `quantity` (number, min:1), `unitPrice` (number, cents), `taxRate` (number, 0-100, default:19) }), `dueDate` (date, must be future, max 90 days)
Auth: finance, company_admin
- Order muss DELIVERED oder COMPLETED sein → 422 ORDER_NOT_COMPLETE
- Pro Order nur 1 Rechnung → 409 DUPLICATE_INVOICE
- Rechnungssumme darf Bestellsumme nicht um mehr als 5% überschreiten → 400 INVOICE_EXCEEDS_ORDER
- Side-effects: Gesamtberechnung (quantity × unitPrice × (1 + taxRate/100))

### POST /api/payments
Zahlung buchen.
Input: `companyId` (number), `amount` (number, cents, min:1), `method` (enum: BANK_TRANSFER|WIRE|DIRECT_DEBIT), `reference` (string, max:100)
Auth: finance, company_admin
- Rechnung muss PENDING sein → 422 INVOICE_NOT_PENDING
- amount muss = Rechnungssumme sein → 400 AMOUNT_MISMATCH
- Bereits bezahlt → 409 ALREADY_PAID
- Tägliches Zahlungslimit: 2.000.000 EUR → 422 DAILY_PAYMENT_LIMIT
- Side-effects: invoice.status → PAID, invoice.paidAt

### GET /api/reports/inventory
Bestandsbericht.
Output: pro Lager: totalProducts, totalValue, expiringItems, belowReorderPoint
Auth: warehouse_manager (eigenes Lager), logistics_coordinator, finance, company_admin

### DELETE /api/contacts/:id/gdpr
DSGVO-Löschung (Kundenkontakte).
Auth: company_admin
- contactName → "[GELÖSCHT]", email → null, phone → null, address → null, taxId → "[REDACTED]"
- Bestellungen bleiben erhalten (Aufbewahrungspflicht 10 Jahre)
- Aktive Bestellungen verhindern Löschung → 422 ACTIVE_ORDERS_EXIST

## Status Machine: orders
States: DRAFT, CONFIRMED, PROCESSING, SHIPPED, IN_TRANSIT, DELIVERED, PARTIALLY_RETURNED, FULLY_RETURNED, COMPLETED, CANCELLED, ON_HOLD

Erlaubte Übergänge:
- DRAFT → CONFIRMED (logistics_coordinator bestätigt)
- CONFIRMED → PROCESSING (warehouse_manager beginnt Kommissionierung)
- CONFIRMED → CANCELLED (logistics_coordinator, note Pflicht)
- CONFIRMED → ON_HOLD (company_admin, note Pflicht)
- ON_HOLD → CONFIRMED (company_admin hebt Hold auf)
- PROCESSING → SHIPPED (warehouse_manager erstellt Lieferung)
- SHIPPED → IN_TRANSIT (Carrier-Update)
- IN_TRANSIT → DELIVERED (Zustellbestätigung)
- DELIVERED → COMPLETED (nach Rechnungsbezahlung, automatisch)
- DELIVERED → PARTIALLY_RETURNED (Teilretoure)
- DELIVERED → FULLY_RETURNED (Vollretoure)
- PARTIALLY_RETURNED → COMPLETED (nach Gutschrift)
- FULLY_RETURNED → CANCELLED (nach Gutschrift)

Verbotene Übergänge:
- COMPLETED → jeder Status (Terminal)
- CANCELLED → jeder Status (Terminal)
- DELIVERED → DRAFT (kein Zurücksetzen)
- SHIPPED → CONFIRMED (kein Zurücknehmen nach Versand)
- DRAFT → SHIPPED (muss CONFIRMED → PROCESSING → SHIPPED durchlaufen)

Side-effects:
- → CONFIRMED: confirmedAt = NOW(), Bestand reserviert
- → PROCESSING: processingStartedAt = NOW()
- → SHIPPED: shippedAt = NOW(), Bestand abgebucht
- → DELIVERED: deliveredAt = NOW()
- → CANCELLED: cancelledAt = NOW(), reservierter Bestand freigegeben, cancelReason = note
- → ON_HOLD: holdReason = note, holdStartedAt = NOW()
- → COMPLETED: completedAt = NOW()

## Status Machine: shipments
States: CREATED, PICKED_UP, IN_TRANSIT, CUSTOMS_HOLD, ARRIVED, DELIVERED, RETURNED

Erlaubte Übergänge:
- CREATED → PICKED_UP (Carrier holt ab)
- PICKED_UP → IN_TRANSIT
- IN_TRANSIT → CUSTOMS_HOLD (nur bei internationalem Versand)
- CUSTOMS_HOLD → IN_TRANSIT (Zoll freigegeben)
- IN_TRANSIT → ARRIVED (am Zielort)
- ARRIVED → DELIVERED (Zustellung bestätigt)
- jeder Status → RETURNED (bei Retoure)

Verbotene Übergänge:
- DELIVERED → jeder Status (Terminal)
- RETURNED → jeder Status (Terminal)

## Geschäftsregeln

### Mengenrabatt
| Bestellmenge | Rabatt |
|---|---|
| 1-49 | 0% |
| 50-199 | 3% |
| 200-999 | 7% |
| 1000+ | 12% |

### Versandkosten
- STANDARD: Basis 500 + (Gesamtgewicht / 1000 × 8) Cent
- EXPRESS: Basis 1500 + (Gesamtgewicht / 1000 × 15) Cent
- OVERNIGHT: Basis 3000 + (Gesamtgewicht / 1000 × 25) Cent

### Ablaufende Waren
- FOOD/PHARMA mit expiryDate < 30 Tage: automatische Warnung
- expiryDate überschritten: Ware wird als EXPIRED markiert, kann nicht versendet werden

## Fehler-Codes

| Code | HTTP | Bedeutung |
|---|---|---|
| COMPANY_MISMATCH | 403 | Cross-Tenant-Zugriff |
| WAREHOUSE_MISMATCH | 403 | Falsches Lager |
| SKU_EXISTS | 409 | SKU bereits vorhanden |
| EXPIRY_REQUIRED | 400 | Ablaufdatum fehlt für FOOD/PHARMA |
| WAREHOUSE_FULL | 422 | Lagerkapazität überschritten |
| PRODUCT_NOT_FOUND | 404 | SKU existiert nicht |
| INSUFFICIENT_STOCK | 422 | Bestand nicht ausreichend |
| ORDER_NOT_CONFIRMED | 422 | Lieferung für unbestätigte Bestellung |
| TRACKING_EXISTS | 409 | Tracking-Nummer bereits vergeben |
| ITEM_NOT_IN_WAREHOUSE | 422 | Ware nicht im Versandlager |
| ORDER_NOT_DELIVERED | 422 | Retoure für nicht gelieferte Bestellung |
| QUANTITY_EXCEEDS_ORDER | 400 | Retourmenge > Bestellmenge |
| RETURN_EXISTS | 409 | Doppelte Retoure |
| ORDER_NOT_COMPLETE | 422 | Rechnung für unvollständige Bestellung |
| DUPLICATE_INVOICE | 409 | Doppelte Rechnung |
| INVOICE_EXCEEDS_ORDER | 400 | Rechnungssumme > 105% der Bestellsumme |
| INVOICE_NOT_PENDING | 422 | Zahlung für nicht ausstehende Rechnung |
| AMOUNT_MISMATCH | 400 | Zahlbetrag ≠ Rechnungssumme |
| ALREADY_PAID | 409 | Doppelzahlung |
| DAILY_PAYMENT_LIMIT | 422 | Tägliches Zahlungslimit überschritten |
| ACTIVE_ORDERS_EXIST | 422 | GDPR-Löschung bei aktiven Bestellungen |
| INVALID_TRANSITION | 422 | Ungültiger Statusübergang |

## DSGVO
- DELETE /api/contacts/:id/gdpr — 5 PII-Felder
- contactName → "[GELÖSCHT]", email → null, phone → null, address → null, taxId → "[REDACTED]"
- GET /api/contacts/:id/export — vollständiger Datenexport

## User Flows

### Flow 1: Wareneingang
1. Warehouse_worker loggt sich ein
2. Navigiert zu /inventory/receive
3. Wählt Lager (nur eigenes)
4. Scannt/wählt Produkte, gibt Menge ein
5. Optional: Liefernotiz, Chargennummer
6. Bestätigt Eingang
7. API verify: Bestand erhöht, Bestandsbewegung geloggt

### Flow 2: Bestellung und Versand
1. Logistics_coordinator loggt sich ein
2. Navigiert zu /orders/new
3. Wählt Kunde, fügt Produkte hinzu
4. Wählt Priorität und Versandart
5. Bestätigt Bestellung
6. Warehouse_manager erstellt Lieferung
7. API verify: order.status = SHIPPED, tracking number gesetzt

### Flow 3: Retoure
1. Warehouse_manager loggt sich ein
2. Navigiert zu /returns
3. Wählt gelieferte Bestellung
4. Gibt retournierte Artikel, Mengen, Gründe ein
5. Bestätigt Retoure
6. API verify: Bestand aktualisiert, order.status = PARTIALLY_RETURNED
