import assert from "node:assert/strict";
import {rolePermissions} from "../lib/cms/registry";
for(const role of ["Editor","Viewer"]){const keys=rolePermissions(role);assert.ok(!keys.includes("store:write"));assert.ok(!keys.includes("store:refund"));assert.ok(!keys.includes("store:read"));console.log(`PASS ${role} has no default access to commerce customer records, fulfillment or refunds`);}
assert.ok(rolePermissions("Super Admin").includes("store:refund"));console.log("PASS Super Admin retains explicit commerce permissions");
