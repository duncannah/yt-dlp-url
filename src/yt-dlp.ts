import * as fs from "fs/promises";
import path from "path";
import { execFile } from "promisify-child-process";
import { z } from "zod";
import fetch from "node-fetch";
import { isErrnoException } from "./constants.js";
import "dotenv/config";

const HydrationInterval = 1000 * 60 * 60 * 1; // One hour
const BinPath = path.join("bin");
const LatestVerPath = path.join(BinPath, "latest");
const YTDLPPath = path.join(BinPath, "yt-dlp");

const GitHubRepo = process.env["YTDLP-REPO"] || "yt-dlp/yt-dlp";

const GitHubReleasesSchema = z.array(
	z.object({
		target_commitish: z.string(),
		assets: z.array(
			z.object({
				name: z.string(),
				browser_download_url: z.string().url(),
			})
		),
	})
);

const getLatestReleases = async () => {
	const res = await fetch(`https://api.github.com/repos/${GitHubRepo}/releases`);
	return GitHubReleasesSchema.parse(await res.json());
};

const hydrate = async () => {
	// Create directory if it doesn't exist
	await fs.mkdir(BinPath).catch((e) => {
		if (!isErrnoException(e) || e["code"] !== "EEXIST") throw e;
	});

	const currentVersion = (await fs.readFile(LatestVerPath).catch(() => "")).toString();

	const latestRelease = (await getLatestReleases())[0];
	if (latestRelease.target_commitish === currentVersion) return;

	const YTDLPBinAsset = latestRelease.assets.find((a) => a.name === "yt-dlp");
	if (!YTDLPBinAsset) throw new Error("Can't find yt-dlp in release assets");

	const bin = await fetch(YTDLPBinAsset.browser_download_url);

	await fs.writeFile(YTDLPPath, Buffer.from(await bin.arrayBuffer()));
	await fs.writeFile(LatestVerPath, latestRelease.target_commitish);
};

export const startHydrating = () => {
	hydrate()
		.then(() =>
			setInterval(() => {
				hydrate().catch(console.error);
			}, HydrationInterval)
		)
		.catch(console.error);
};

const YTDLPFormatSchema = z.object({
	url: z.string().url(),
	vcodec: z.string().nullish(),
	acodec: z.string().nullish(),
	fragments: z.array(z.object({}).optional()).nullish(),
});

const YTDLPSchema = z.object({
	_type: z.string(),
	title: z.string().nullish().default(""),
	formats: z.array(YTDLPFormatSchema).optional(),
	entries: z
		.array(
			z.object({
				formats: z.array(YTDLPFormatSchema).nullish(),
				url: z.string().url(),
				title: z.string().nullish().default(""),
			})
		)
		.optional(),
	requested_downloads: z
		.array(z.object({ url: z.string().url().optional() }).optional())
		.nullish()
		.optional(),
	direct: z.boolean().optional(),
	url: z.string().nullish(),
});

const getMediaInfo = async (url: string, formatOptions: string) => {
	const formatArgs = [];
	if (formatOptions) formatArgs.push("-f", formatOptions);

	const { stdout } = await execFile(
		"python3",
		[YTDLPPath, "--no-warnings", "-J", "--flat-playlist", ...formatArgs, "--", url],
		{ maxBuffer: 1000 * 1000 * 2, timeout: 1000 * 60 }
	);

	if (!stdout) throw new Error();

	return YTDLPSchema.parse(JSON.parse(stdout.toString()));
};

const pickBestFormats = (formats: z.infer<typeof YTDLPFormatSchema>[]) => {
	return formats
		.reverse()
		.filter((f) => !f.fragments && f.vcodec !== "none" && f.acodec !== "none");
};

export const getMedia = async (url: string, formatOptions: string) => {
	const mediaInfo = await getMediaInfo(url, formatOptions);

	const entries: {
		url: string;
		title: string | null;
		direct?: boolean;
		[key: string]: unknown;
	}[] = [];

	if (mediaInfo.direct) return mediaInfo.url;
	else if (formatOptions && mediaInfo.requested_downloads && mediaInfo.requested_downloads[0])
		return mediaInfo.requested_downloads[0].url;
	else if (["playlist", "multi_video"].includes(mediaInfo._type) && mediaInfo.entries)
		entries.push(...mediaInfo.entries);
	else if (mediaInfo.formats)
		entries.push({
			...pickBestFormats(mediaInfo.formats)[0],
			title: mediaInfo.title,
			direct: true,
		});

	return entries;
};
