/*
檔案位置：jonaminz/backend/cloudflare-worker/generate-contract-validator.mjs
用途：Cloudflare Workers 的 V8 isolate 預設禁止動態程式碼生成（eval/new Function），
而 ajv 預設在 runtime 用 new Function 把 schema 編譯成驗證函式——這在 Workers 上會
直接讓部署失敗（"Code generation from strings disallowed for this context"）。
ajv 官方針對這類環境（CSP 限制的瀏覽器、serverless/edge runtime）提供「standalone
code」機制：build time 先把 schema 編譯成一份純 JS 原始碼（不含 codegen 機器本身），
worker.js 直接 import 這份產出檔案，runtime 完全不呼叫 new Function。

用法：改了 docs/contract-schema/jonaminz.contract.schema.json 之後，在
backend/cloudflare-worker/ 下執行：

    node generate-contract-validator.mjs

會覆寫 contract-schema-validator.generated.js（該檔案是產出品，但仍要 commit
進 repo，因為 Workers 部署時不會執行這支腳本，只會直接 bundle 產出檔案）。
*/

import { writeFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import standaloneCode from "ajv/dist/standalone/index.js";
import contractSchema from "../../docs/contract-schema/jonaminz.contract.schema.json" with { type: "json" };

const ajv = new Ajv2020({
  code: { source: true, esm: true },
  allErrors: true,
  strict: false
});

const validate = ajv.compile(contractSchema);
const moduleCode = standaloneCode(ajv, validate);

const outPath = new URL("./contract-schema-validator.generated.js", import.meta.url);
const header =
  "/*\n" +
  " * 自動產生，不要手動編輯。\n" +
  " * 來源：docs/contract-schema/jonaminz.contract.schema.json\n" +
  " * 產生方式：node generate-contract-validator.mjs（改了 schema 之後要重跑這支腳本）\n" +
  " * 為什麼需要這份產出檔案，而不是在 worker.js 裡直接 ajv.compile(schema)：\n" +
  " * Cloudflare Workers 禁止 new Function/eval，ajv 預設的 runtime compile 會噴\n" +
  " * \"Code generation from strings disallowed for this context\"。這份檔案是\n" +
  " * build time 先編譯好的純 JS，worker.js 直接 import 使用，執行期不再呼叫\n" +
  " * new Function。\n" +
  " */\n";

writeFileSync(outPath, header + moduleCode);
console.log("Wrote " + outPath.pathname);
