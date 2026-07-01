import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_PROXY_TIMEOUT_MS = 60000;

export async function GET(request: NextRequest) {
    const target = request.nextUrl.searchParams.get("url") || "";
    if (!target) return new Response("Missing url", { status: 400 });

    let url: URL;
    try {
        url = new URL(target);
    } catch {
        return new Response("Invalid url", { status: 400 });
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return new Response("Unsupported image url", { status: 400 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_PROXY_TIMEOUT_MS);
    try {
        const response = await fetch(url, { signal: controller.signal, cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.toLowerCase().startsWith("image/")) return new Response("Target is not an image", { status: 415 });

        return new Response(response.body, {
            status: response.status,
            headers: responseHeaders(response.headers),
        });
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return new Response("Image proxy timeout", { status: 504 });
        return new Response(error instanceof Error ? error.message : "Image proxy error", { status: 502 });
    } finally {
        clearTimeout(timer);
    }
}

function responseHeaders(headers: Headers) {
    const result = new Headers();
    ["content-type", "content-length", "etag", "last-modified", "cache-control"].forEach((key) => {
        const value = headers.get(key);
        if (value) result.set(key, value);
    });
    result.set("access-control-allow-origin", "*");
    return result;
}
