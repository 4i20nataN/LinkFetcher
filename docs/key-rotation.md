# Ed25519 키 로테이션 절차 (Key Rotation)

## 개요
매니페스트 서명에 사용되는 Ed25519 키는 주기적으로 교체해야 합니다. 교체 시 **기존 사용자 업데이트가 끊기지 않도록** "듀얼 사인(Dual-sign) → 제거" 2단계 절차를 따릅니다.

---

## 현재 상태

| Key ID | 용도 | 상태 |
|--------|------|------|
| `v1` | 현재 운영 키 | `verifyRelease.cjs`의 `TRUSTED_PUBLIC_KEYS.v1`에 등록됨 |
| `v2` | 차기 키 | **미등록** (로테이션 시 추가) |

---

## 로테이션 절차 (Zero-Downtime)

### 1단계: 새 키 생성 (오프라인/보안 환경)

```bash
# 로컬에서 실행 (CI 아님!)
node scripts/generate-signing-key.cjs
```

출력:
- `private-key.pem` → **GitHub Actions Secret: `UPDATE_SIGNING_PRIVATE_KEY_V2`** 저장
- `public-key.pem` → `verifyRelease.cjs`의 `TRUSTED_PUBLIC_KEYS.v2`에 복사

> ⚠️ **절대** 프라이빗 키를 커밋하지 마세요. GitHub Actions Secret으로만 관리.

### 2단계: 듀얼 사인 지원 활성화 (App 코드)

`electron/updater/verifyRelease.cjs`의 `TRUSTED_PUBLIC_KEYS`에 **v2 추가**:

```javascript
const TRUSTED_PUBLIC_KEYS = {
  v1: `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA/b86YtHcdb332WCuUkMzyQ12IdZA5ow760QVTt/DABo=
-----END PUBLIC KEY-----`,
  v2: `-----BEGIN PUBLIC KEY-----
REPLACE_WITH_NEW_PUBLIC_KEY_FROM_STEP_1
-----END PUBLIC KEY-----`,
};
```

- `verifyManifestSignature()`는 이미 **모든 키를 순회하며 검증**하도록 구현됨 (v1 → v2 순서)
- 이 상태로 **앱 업데이트 배포** (v1 키로 서명된 매니페스트도, v2로 서명된 것도 모두 수신 가능)

### 3단계: CI 파이프라인 듀얼 사인 적용

`.github/workflows/release.yml`에서 **두 키로 동시 서명**:

```yaml
- name: Sign manifest with v1 (current)
  run: |
    node scripts/sign-manifest.cjs \
      --private-key ${{ secrets.UPDATE_SIGNING_PRIVATE_KEY }} \
      --output manifest.json.sig.v1

- name: Sign manifest with v2 (new)
  run: |
    node scripts/sign-manifest.cjs \
      --private-key ${{ secrets.UPDATE_SIGNING_PRIVATE_KEY_V2 }} \
      --output manifest.json.sig.v2
```

릴리스 에셋에 **둘 다 업로드**:
- `manifest.json.sig` ← v1 서명 (기존 호환용)
- `manifest.json.sig.v2` ← v2 서명 (신규 앱용)

> 실제로는 `manifest.json.sig`를 v2로 교체하고, v1은 구버전 앱이 다운로드할 수 있도록 별도 경로에 유지하거나, 앱이 v2를 먼저 시도하고 실패 시 v1 폴백하도록 구현.

### 4단계: 전환 기간 (최소 1 릴리스 사이클)

| 기간 | 앱 버전 | 서명 키 | 비고 |
|------|---------|---------|------|
| 현재 | ≤ 1.0.x | v1 | 기존 사용자 |
| 전환 | 1.1.0 | v1 + v2 (듀얼) | v1/v2 모두 검증 가능 |
| 완료 후 | ≥ 1.2.0 | v2 only | v1 제거 |

**핵심**: v1 키로 서명된 매니페스트도 새 앱(v2 키 보유)이 검증 가능하도록 **앱 업데이트 먼저 배포** → 그 다음 릴리스부터 v2 단독 서명으로 전환.

### 5단계: v1 제거 (Cleanup)

1. `verifyRelease.cjs`에서 `v1` 엔트리 삭제
2. GitHub Actions Secret `UPDATE_SIGNING_PRIVATE_KEY` 폐기/순환
3. CI에서 v1 서명 단계 제거
4. 앱 배포 (이제 v2만 신뢰)

---

## 비상 시: 키 유출 대응 (Emergency Rotation)

키가 유출된 경우 **즉시** 수행:

1. **즉시** 새 키 생성 (`v2`)
2. `UPDATE_SIGNING_PRIVATE_KEY` Secret **즉시 교체** (v2로)
3. `verifyRelease.cjs`에 `v2` 추가, `v1` **즉시 비활성화** (주석 처리 또는 삭제)
4. 핫픽스 앱 배포 (강제 업데이트 권장)
5. GitHub Releases의 기존 `manifest.json.sig` **모두 재서명** (v2로) — 불가능하면 해당 버전 삭제/비공개

> 유출 시에는 듀얼 사인 기간 없이 **즉시 교체**가 원칙입니다.

---

## 자동화 스크립트

### `scripts/sign-manifest.cjs`
```javascript
#!/usr/bin/env node
'use strict';

const { sign: cryptoSign, createPrivateKey } = require('node:crypto');
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const [, , ...args] = process.argv;
const opts = Object.fromEntries(args.map(a => a.split('=')));

const privateKeyPem = readFileSync(opts['--private-key'], 'utf-8');
const manifestPath = opts['--manifest'] || 'manifest.json';
const outputPath = opts['--output'] || 'manifest.json.sig';

const manifest = readFileSync(manifestPath);
const privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem' });
const signature = cryptoSign(null, manifest, privateKey);
writeFileSync(outputPath, signature.toString('base64'));
console.log(`✅ Signed ${manifestPath} → ${outputPath}`);
```

### `scripts/generate-signing-key.cjs`
이미 생성됨 — `npm run generate:signing-key`로 실행.

---

## 체크리스트

| 단계 | 완료 |
|------|------|
| [ ] 새 키 쌍 생성 (`generate-signing-key.cjs`) | |
| [ ] Private key → GitHub Secret `UPDATE_SIGNING_PRIVATE_KEY_V2` | |
| [ ] Public key → `verifyRelease.cjs` `TRUSTED_PUBLIC_KEYS.v2` 추가 | |
| [ ] 앱 배포 (듀얼 검증 지원 버전) | |
| [ ] CI: 듀얼 사인 (v1 + v2) 적용 | |
| [ ] 1 릴리스 사이클 대기 (기존 사용자 모두 새 앱으로 업데이트) | |
| [ ] `verifyRelease.cjs`에서 `v1` 제거 | |
| [ ] CI에서 v1 서명 단계 제거 | |
| [ ] 구 Secret `UPDATE_SIGNING_PRIVATE_KEY` 순환/삭제 | |

---

## 참고: 키 포맷

| 포맷 | 용도 |
|------|------|
| PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`) | 프라이빗 키 (CI Secret) |
| SPKI PEM (`-----BEGIN PUBLIC KEY-----`) | 퍼블릭 키 (앱 코드 임베드) |

```bash
# 수동 변환 필요 시
openssl pkcs8 -topk8 -inform PEM -in private.pem -outform PEM -nocrypt -out private-pkcs8.pem
openssl pkey -in private-pkcs8.pem -pubout -outform PEM -out public-spki.pem
```