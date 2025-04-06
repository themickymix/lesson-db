import { Hono } from "hono";
import { handle } from "hono/vercel";
import { fetch } from "undici";
import { kv } from "@vercel/kv";
export const runtime = "nodejs";
// Define types for better type safety
type GitHubContent = {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: string;
  _links: {
    self: string;
    git: string;
    html: string;
  };
};

// GitHub API and Token
const GITHUB_API_URL =
  "https://api.github.com/repos/Adventech/sabbath-school-lessons/contents/src";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Helper function to check KV or fetch from GitHub
const getFromKVOrGitHub = async (
  path: string
): Promise<GitHubContent | GitHubContent[]> => {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const cacheKey = `github:${cleanPath}`;

  // Try to get from Vercel KV
  const cached = await kv.get<GitHubContent | GitHubContent[]>(cacheKey);
  if (cached) {
    console.log(`Serving from cache: ${cacheKey}`);
    return cached;
  }

  // Fetch fresh from GitHub
  console.log(`Fetching from GitHub: ${cleanPath}`);
  const url = `${GITHUB_API_URL}${cleanPath}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `token ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `GitHub API error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = (await response.json()) as GitHubContent | GitHubContent[];

  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error("Empty response data from GitHub");
  }

  // Cache for 1 hour (3600 seconds)
  await kv.set(cacheKey, data, { ex: 3600 });

  return data;
};


const app = new Hono().basePath("/api");

app.get("/test", (c) => c.text("Hello Node.js + KV!"));

app.get("/lessons/:language", async (c) => {
  try {
    const language = c.req.param("language");
    if (!language) {
      return c.json({ message: "Language parameter is required" }, 400);
    }
    const data = await getFromKVOrGitHub(`${language}`);
    return c.json(data);
  } catch (error) {
    console.error("Error in /lessons/:language:", error);
    return c.json(
      { message: `Error fetching data: ${(error as Error).message}` },
      500
    );
  }
});

app.get("/lessons/:language/:quarter", async (c) => {
  try {
    const language = c.req.param("language");
    const quarter = c.req.param("quarter");
    if (!language || !quarter) {
      return c.json(
        { message: "Language and quarter parameters are required" },
        400
      );
    }
    const data = await getFromKVOrGitHub(`${language}/${quarter}`);
    return c.json(data);
  } catch (error) {
    console.error("Error in /lessons/:language/:quarter:", error);
    return c.json(
      { message: `Error fetching data: ${(error as Error).message}` },
      500
    );
  }
});

app.get("/lessons/:language/:quarter/:lesson", async (c) => {
  try {
    const language = c.req.param("language");
    const quarter = c.req.param("quarter");
    const lesson = c.req.param("lesson");

    if (!language || !quarter || !lesson) {
      return c.json(
        { message: "Language, quarter, and lesson parameters are required" },
        400
      );
    }

    const data = await getFromKVOrGitHub(`${language}/${quarter}/${lesson}`);
    return c.json(data);
  } catch (error) {
    console.error("Error in /lessons/:language/:quarter/:lesson:", error);
    return c.json(
      { message: `Error fetching data: ${(error as Error).message}` },
      500
    );
  }
});

app.get("/lessons/:language/:quarter/:lesson/:day", async (c) => {
  try {
    const language = c.req.param("language");
    const quarter = c.req.param("quarter");
    const lesson = c.req.param("lesson");
    const day = c.req.param("day");

    if (!language || !quarter || !lesson || !day) {
      return c.json({ message: "All parameters are required" }, 400);
    }

    const data = await getFromKVOrGitHub(
      `${language}/${quarter}/${lesson}/${day}`
    );
    return c.json(data);
  } catch (error) {
    console.error("Error in /lessons/:language/:quarter/:lesson/:day:", error);
    return c.json(
      { message: `Error fetching data: ${(error as Error).message}` },
      500
    );
  }
});

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
