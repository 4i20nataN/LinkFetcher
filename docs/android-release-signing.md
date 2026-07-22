# Android — Assinatura de Build Release (gap #9)

Antes deste fix, `android/app/build.gradle` não tinha `signingConfig` nenhum para o
build type `release` — `assembleRelease` gerava um APK **não assinado**, só era
possível instalar via debug keystore/Android Studio "Generate Signed APK" manual.

## Gerar o keystore (uma vez)

```bash
keytool -genkeypair -v \
  -keystore linkfetcher-release.jks \
  -alias linkfetcher \
  -keyalg RSA -keysize 2048 -validity 10000
```

Guarde `linkfetcher-release.jks` fora do repositório (o `.gitignore` já bloqueia
`*.jks`/`*.keystore`). **Nunca commite esse arquivo.**

## Configurar o build

O `build.gradle` agora lê 4 propriedades Gradle (`RELEASE_STORE_FILE`,
`RELEASE_STORE_PASSWORD`, `RELEASE_KEY_ALIAS`, `RELEASE_KEY_PASSWORD`). Se elas
não existirem, o release continua sendo gerado sem assinatura (comportamento
anterior preservado — nada quebra para quem só faz build debug/dev).

**Local** — adicione ao `~/.gradle/gradle.properties` (fora do repo):

```properties
RELEASE_STORE_FILE=/caminho/absoluto/para/linkfetcher-release.jks
RELEASE_STORE_PASSWORD=sua_senha
RELEASE_KEY_ALIAS=linkfetcher
RELEASE_KEY_PASSWORD=sua_senha_da_chave
```

**CI (GitHub Actions, etc.)** — exporte como env vars com prefixo
`ORG_GRADLE_PROJECT_`, que o Gradle mapeia automaticamente para project
properties:

```yaml
env:
  ORG_GRADLE_PROJECT_RELEASE_STORE_FILE: ${{ github.workspace }}/linkfetcher-release.jks
  ORG_GRADLE_PROJECT_RELEASE_STORE_PASSWORD: ${{ secrets.RELEASE_STORE_PASSWORD }}
  ORG_GRADLE_PROJECT_RELEASE_KEY_ALIAS: ${{ secrets.RELEASE_KEY_ALIAS }}
  ORG_GRADLE_PROJECT_RELEASE_KEY_PASSWORD: ${{ secrets.RELEASE_KEY_PASSWORD }}
```

(decodifique o `.jks` de um secret base64 para esse path antes do build.)

## Build

```bash
npm run build && npx cap sync android
cd android && ./gradlew assembleRelease
# APK assinado: android/app/build/outputs/apk/release/app-release.apk
```
