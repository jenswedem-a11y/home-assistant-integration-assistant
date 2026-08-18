#!/usr/bin/env node

import {createRequire} from "node:module";
import fs from "node:fs/promises";
import path from "node:path";

const require = createRequire(import.meta.url);

process.stdout.on("error", (error) => {
  if (error.code === "EPIPE") {
    process.exit(0);
  }
  throw error;
});

function parseArgs(argv) {
  const args = {
    zhcPath: undefined,
    output: undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--zhc-path") {
      args.zhcPath = argv[index + 1];
      index += 1;
    } else if (arg === "--output") {
      args.output = argv[index + 1];
      index += 1;
    }
  }

  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function stripFunctions(value, depth = 0) {
  if (depth > 8) {
    return undefined;
  }
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "function") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripFunctions(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      if (typeof nested === "function") {
        continue;
      }
      const plain = stripFunctions(nested, depth + 1);
      if (plain !== undefined) {
        result[key] = plain;
      }
    }
    return result;
  }
  return undefined;
}

function converterNames(converters) {
  if (!Array.isArray(converters)) {
    return [];
  }
  return converters
    .map((converter) => converter?.name || converter?.key?.join?.(",") || converter?.cluster || undefined)
    .filter(Boolean);
}

function exposeCategory(exposes) {
  const text = JSON.stringify(exposes ?? []).toLowerCase();
  if (text.includes("occupancy") || text.includes("motion") || text.includes("contact")) {
    return "sensor";
  }
  if (text.includes("brightness") || text.includes("color_temp") || text.includes("light")) {
    return "light";
  }
  if (text.includes("power") || text.includes("energy") || text.includes("switch")) {
    return "plug";
  }
  return undefined;
}

function normalizeWhiteLabel(whiteLabel) {
  if (!Array.isArray(whiteLabel)) {
    return [];
  }
  return whiteLabel.map((entry) => stripFunctions(entry)).filter(Boolean);
}

function normalizeFingerprints(fingerprint) {
  if (!Array.isArray(fingerprint)) {
    return [];
  }
  return fingerprint
    .map((entry) => {
      const plain = stripFunctions(entry);
      if (!plain || typeof plain !== "object") {
        return undefined;
      }
      return plain;
    })
    .filter(Boolean);
}

function normalizeDefinition(baseDefinition, preparedDefinition) {
  const exposes = Array.isArray(preparedDefinition.exposes)
    ? preparedDefinition.exposes
    : preparedDefinition.exposes?.({isDummyDevice: true}, {});
  const plainExposes = stripFunctions(exposes) ?? [];
  const model = preparedDefinition.model ?? baseDefinition.model;

  return {
    vendor: preparedDefinition.vendor ?? baseDefinition.vendor,
    model,
    display_name: `${preparedDefinition.vendor ?? baseDefinition.vendor} ${model}`,
    description: preparedDefinition.description ?? baseDefinition.description,
    category: exposeCategory(plainExposes),
    zigbeeModel: preparedDefinition.zigbeeModel ?? baseDefinition.zigbeeModel ?? [],
    fingerprint: normalizeFingerprints(preparedDefinition.fingerprint ?? baseDefinition.fingerprint),
    whiteLabel: normalizeWhiteLabel(preparedDefinition.whiteLabel ?? baseDefinition.whiteLabel),
    exposes: plainExposes,
    options: stripFunctions(preparedDefinition.options ?? []),
    fromZigbee: converterNames(preparedDefinition.fromZigbee),
    toZigbee: converterNames(preparedDefinition.toZigbee),
    ota: Boolean(preparedDefinition.ota ?? baseDefinition.ota),
    source_url: `https://www.zigbee2mqtt.io/devices/${model}.html`,
    compatibility_notes: "Definition exists in zigbee-herdsman-converters.",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.zhcPath) {
    fail("--zhc-path fehlt.");
  }
  const root = path.resolve(args.zhcPath);
  const packageJson = path.join(root, "package.json");
  const distIndex = path.join(root, "dist", "index.js");
  const devicesIndex = path.join(root, "dist", "devices", "index.js");

  if (!(await exists(packageJson))) {
    fail(`package.json nicht gefunden: ${packageJson}`);
  }
  if (!(await exists(distIndex)) || !(await exists(devicesIndex))) {
    fail(
      "zigbee-herdsman-converters ist lokal vorhanden, aber noch nicht gebaut. " +
        "Bitte im ZHC-Repository ausfuehren: pnpm install --frozen-lockfile && pnpm run build",
    );
  }

  const zhcModule = require(distIndex);
  const devicesModule = require(devicesIndex);
  const prepareDefinition = zhcModule.prepareDefinition ?? zhcModule.default?.prepareDefinition;
  const baseDefinitions = devicesModule.default ?? devicesModule.definitions ?? devicesModule;

  if (!Array.isArray(baseDefinitions)) {
    fail("Konnte keine Device-Definitionen aus dist/devices/index.js lesen.");
  }
  if (baseDefinitions.length === 0) {
    fail("Keine Device-Definitionen aus dist/devices/index.js gelesen.");
  }
  if (typeof prepareDefinition !== "function") {
    fail("Konnte prepareDefinition aus dist/index.js nicht lesen.");
  }

  const devices = [];
  for (const baseDefinition of baseDefinitions) {
    const preparedDefinition = prepareDefinition(baseDefinition);
    devices.push(normalizeDefinition(baseDefinition, preparedDefinition));
  }

  const json = JSON.stringify({devices}, null, 2);
  if (args.output) {
    await fs.writeFile(args.output, json, "utf8");
  } else {
    process.stdout.write(`${json}\n`);
  }
}

main().catch((error) => {
  fail(`ZHC-Export fehlgeschlagen: ${error?.stack ?? error}`);
});
