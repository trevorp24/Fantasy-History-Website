import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

for (const scenario of ["success", "export failure", "update failure"]) {
  test(`export-and-update launcher: ${scenario}`, { skip: process.platform !== "win32" }, () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "chudgate-launcher-"));
    try {
      fs.copyFileSync(new URL("../export-and-update-moggate-site.cmd", import.meta.url), path.join(folder, "export-and-update-moggate-site.cmd"));
      fs.writeFileSync(path.join(folder, "export-moggate-json.ps1"), scenario === "export failure"
        ? "Write-Output 'SIMULATED_EXPORT_ERROR'; exit 7"
        : "Write-Output 'EXPORT_OK'; exit 0");
      fs.writeFileSync(path.join(folder, "update-moggate-site.ps1"), scenario === "update failure"
        ? "Write-Output 'SIMULATED_UPDATE_ERROR'; exit 8"
        : "Write-Output 'UPDATE_OK'; exit 0");
      const result = spawnSync("cmd.exe", ["/d", "/c", path.join(folder, "export-and-update-moggate-site.cmd")], {
        input: "\r\n",
        encoding: "utf8",
        timeout: 30000
      });
      assert.ifError(result.error);
      const output = result.stdout + result.stderr;
      assert.match(output, /Press any key/i);
      assert.equal(result.status, scenario === "success" ? 0 : 1, output);
      if (scenario === "export failure") {
        assert.match(output, /SIMULATED_EXPORT_ERROR/);
        assert.match(output, /ESPN export failed/);
        assert.doesNotMatch(output, /UPDATE_OK/);
      } else if (scenario === "update failure") {
        assert.match(output, /EXPORT_OK/);
        assert.match(output, /SIMULATED_UPDATE_ERROR/);
        assert.match(output, /Website update failed/);
      } else {
        assert.match(output, /EXPORT_OK/);
        assert.match(output, /UPDATE_OK/);
        assert.match(output, /Export and update completed/);
      }
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
}
