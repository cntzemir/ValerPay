# API Overview

Base URL (local): `http://localhost:3001`

Authentication: Bearer JWT in `Authorization: Bearer <token>`.

## Auth
- `POST /auth/user/register`
- `POST /auth/user/login`
- `POST /auth/admin/login`

## User (requires USER JWT)
- `GET /user/me`
- `GET /user/config/payments`
- `GET /user/balance`
- `GET /user/requests`
- `POST /user/requests/deposit`
- `POST /user/requests/withdraw`

## Admin (requires ADMIN JWT)
- `GET /admin/config/payments`
- `POST /admin/config/payments`
- `GET /admin/requests`
- `GET /admin/requests/:id`
- `POST /admin/requests/:id/claim`
- `POST /admin/requests/:id/approve`
- `POST /admin/requests/:id/reject`
- `POST /admin/requests/:id/send`
- `POST /admin/requests/:id/request-sms`
- `POST /admin/requests/:id/complete`
- `POST /admin/users/:email/requests/withdraw`
- `GET /admin/logs`
- `GET /admin/ledger/entries`
- `GET /admin/reports/daily`

## Examples (PowerShell)

### Deposit request
```powershell
$depositBody = @{
  method      = "BANK"          # BANK | CARD | CRYPTO
  amountMinor = 150000          # 1500.00
  memo        = "Demo deposit"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3001/user/requests/deposit" `
  -ContentType "application/json" `
  -Body $depositBody
```

### Withdraw request
```powershell
$withdrawBody = @{
  method      = "CARD"          # BANK | CARD | CRYPTO
  amountMinor = 25000           # 250.00
  memo        = "Demo withdraw"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3001/user/requests/withdraw" `
  -ContentType "application/json" `
  -Body $withdrawBody
```
