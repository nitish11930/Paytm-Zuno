import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  chmodSync,
} from "node:fs";
import { resolve, join, dirname } from "node:path";
import { randomBytes } from "node:crypto";
const root = resolve(dirname(import.meta.filename), "..");
const probe = process.argv.includes("--compile-check");
const raw = probe
  ? "https://example.invalid"
  : process.env.ZUNO_ANDROID_URL || process.env.MUNIM_ANDROID_URL;
if (!raw)
  throw new Error(
    "Set ZUNO_ANDROID_URL to the verified online HTTPS origin before building a shareable APK.",
  );
const url = new URL(raw);
if (
  url.protocol !== "https:" ||
  url.origin !== raw ||
  url.username ||
  url.password
)
  throw new Error(
    "ZUNO_ANDROID_URL must be an exact HTTPS origin, without a path.",
  );
if (!probe) {
  const response = await fetch(raw + "/api/health", {
    signal: AbortSignal.timeout(20000),
  });
  const health = await response.json();
  if (
    !response.ok ||
    !health.ok ||
    !health.voiceConfigured ||
    !health.testAccessRequired
  )
    throw new Error("Backend health check failed; no shareable APK built.");
}
const sdk =
  process.env.ANDROID_SDK_ROOT || join(process.env.HOME, "Library/Android/sdk");
const jdk =
  process.env.JAVA_HOME ||
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home";
const bt = join(sdk, "build-tools", "35.0.0");
const jar = join(sdk, "platforms", "android-35", "android.jar");
const out = join(root, "android", "build");
mkdirSync(out, { recursive: true });
const env = {
  ...process.env,
  JAVA_HOME: jdk,
  PATH: join(jdk, "bin") + ":" + process.env.PATH,
};
const run = (exe, args) =>
  execFileSync(exe, args, { cwd: root, env, stdio: "inherit" });
const generated = join(out, "res", "values");
mkdirSync(generated, { recursive: true });
writeFileSync(
  join(generated, "strings.xml"),
  `<resources><string name="backend_url">${raw.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</string></resources>`,
);
const source = join(root, "android/app/src/main");
run(join(bt, "aapt2"), [
  "compile",
  "--dir",
  join(source, "res"),
  "-o",
  join(out, "resources.zip"),
]);
run(join(bt, "aapt2"), [
  "compile",
  "--dir",
  join(out, "res"),
  "-o",
  join(out, "generated.zip"),
]);
run(join(bt, "aapt2"), [
  "link",
  "-I",
  jar,
  "--manifest",
  join(source, "AndroidManifest.xml"),
  "--java",
  join(out, "generated-src"),
  "-o",
  join(out, "base.apk"),
  join(out, "resources.zip"),
  join(out, "generated.zip"),
]);
const classes = join(out, "classes");
mkdirSync(classes, { recursive: true });
run(join(jdk, "bin/javac"), [
  "-source",
  "8",
  "-target",
  "8",
  "-classpath",
  jar,
  "-d",
  classes,
  join(source, "java/in/zuno/demo/MainActivity.java"),
  join(out, "generated-src/in/zuno/demo/R.java"),
]);
const findClasses = (p) =>
  readdirSync(p, { withFileTypes: true }).flatMap((x) =>
    x.isDirectory()
      ? findClasses(join(p, x.name))
      : x.name.endsWith(".class")
        ? [join(p, x.name)]
        : [],
  );
const dex = join(out, "dex");
mkdirSync(dex, { recursive: true });
run(join(bt, "d8"), [
  "--min-api",
  "26",
  "--lib",
  jar,
  "--output",
  dex,
  ...findClasses(classes),
]);
copyFileSync(join(out, "base.apk"), join(out, "unsigned.apk"));
execFileSync(
  "/usr/bin/zip",
  ["-q", "-j", join(out, "unsigned.apk"), join(dex, "classes.dex")],
  { cwd: root, env, stdio: "inherit" },
);
run(join(bt, "zipalign"), [
  "-f",
  "-p",
  "4",
  join(out, "unsigned.apk"),
  join(out, "aligned.apk"),
]);
const privacy = join(root, "privacy");
mkdirSync(privacy, { recursive: true, mode: 0o700 });
const store = join(privacy, "android-test.keystore"),
  pass = join(privacy, "android-test.pass");
if (!existsSync(store)) {
  writeFileSync(pass, randomBytes(32).toString("hex"), { mode: 0o600 });
  run(join(jdk, "bin/keytool"), [
    "-genkeypair",
    "-keystore",
    store,
    "-storepass:file",
    pass,
    "-keypass:file",
    pass,
    "-alias",
    "zuno-test",
    "-keyalg",
    "RSA",
    "-keysize",
    "3072",
    "-validity",
    "3650",
    "-dname",
    "CN=Zuno Test, OU=Demo, O=Team Paradox, C=IN",
    "-noprompt",
  ]);
  chmodSync(store, 0o600);
}
if (!existsSync(pass))
  throw new Error("Signing password file is missing; restore it privately.");
const apk = join(out, probe ? "compile-check.apk" : "Zuno-Test.apk");
run(join(bt, "apksigner"), [
  "sign",
  "--ks",
  store,
  "--ks-pass",
  "file:" + pass,
  "--ks-key-alias",
  "zuno-test",
  "--out",
  apk,
  join(out, "aligned.apk"),
]);
run(join(bt, "apksigner"), ["verify", "--verbose", apk]);
run(join(bt, "zipalign"), ["-c", "-p", "4", apk]);
console.log(
  probe
    ? "Native compile/sign check passed. This probe is NOT a working shareable APK."
    : `APK built and signature verified: ${apk}`,
);
