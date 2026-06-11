import { vi } from "vitest";

export const mockAirflowSuccess = () => {
  global.fetch = vi.fn(async (url) => {
    if (String(url).endsWith("/auth/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: "test-airflow-token" }),
      };
    }

    if (String(url).endsWith("/api/v2/dags/settings_sync/dagRuns")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ok: true }),
      };
    }

    throw new Error(`Unexpected external fetch in test: ${url}`);
  });

  return global.fetch;
};

const jsonResponse = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

export const mockMailchimp = (overrides = {}) => {
  const calls = [];

  global.fetch = vi.fn(async (url, options = {}) => {
    const urlString = String(url);
    const method = options.method || "GET";
    calls.push({ url: urlString, method, options });

    if (overrides.failContent && method === "PUT" && urlString.includes("/campaigns/") && urlString.endsWith("/content")) {
      return jsonResponse({ detail: "content failed" }, 500);
    }

    if (overrides.failUpload && method === "POST" && urlString.endsWith("/file-manager/files")) {
      return jsonResponse({ detail: "upload failed" }, 400);
    }

    if (method === "POST" && urlString.endsWith("/campaigns")) {
      return jsonResponse({ id: "campaign-1", status: "save" });
    }

    if (method === "PUT" && urlString.includes("/campaigns/") && urlString.endsWith("/content")) {
      return jsonResponse({ html: "<p>Rendered</p>" });
    }

    if (method === "POST" && urlString.endsWith("/file-manager/files")) {
      return jsonResponse({ full_size_url: "https://cdn.example.com/image.png" });
    }

    if (method === "PATCH" && urlString.includes("/campaigns/")) {
      return jsonResponse({ ok: true });
    }

    if (method === "DELETE" && urlString.includes("/campaigns/")) {
      return { ok: true, status: 204, json: async () => ({}) };
    }

    if (method === "POST" && urlString.includes("/actions/send")) {
      return { ok: true, status: 204, json: async () => ({}) };
    }

    if (method === "POST" && urlString.includes("/actions/schedule")) {
      return { ok: true, status: 204, json: async () => ({}) };
    }

    if (method === "POST" && urlString.includes("/actions/test")) {
      return { ok: true, status: 204, json: async () => ({}) };
    }

    throw new Error(`Unexpected Mailchimp fetch in test: ${method} ${urlString}`);
  });

  global.fetch.calls = calls;
  return global.fetch;
};
