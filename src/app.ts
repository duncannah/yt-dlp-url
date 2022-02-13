import Koa from "koa";
import * as YTDLP from "./yt-dlp.js";
import "dotenv/config";
import { z } from "zod";

const app = new Koa();

// Force browser error for 404
app.use(async (ctx, next) => {
	await next().catch(console.error);

	if (ctx.status === 404) {
		ctx.status = 404;
		ctx.body = "";
	}
});

app.use(async (ctx) => {
	const BASE_URL = `${ctx.protocol}://${ctx.host}`;

	let url = ctx.request.url.slice(1);
	if (["favicon.ico"].includes(url.split("?")[0])) return;

	// Fix protocol getting mangled by reverse proxy
	url = url.replace(/^(https{0,1}):\/(\w)/, "$1://$2");

	const splitURL = url.split("/");
	let formatOptions = "";
	if (!splitURL[0].match(/[.:]/)) {
		formatOptions = splitURL[0];
		url = splitURL.slice(1).join("/");
	}

	// alias
	if (formatOptions.toLowerCase() === "audio") formatOptions = "all[vcodec=none]";

	if (!url.match(/^https{0,1}:\/\//) && !url.match(/^\w+:\w+$/)) url = `http://${url}`;
	if (!(await z.string().url().safeParseAsync(url)).success) return;

	try {
		const media = await YTDLP.getMedia(url, formatOptions);

		if (!media) return;
		if (typeof media === "string") return ctx.redirect(media);
		else {
			ctx.type = "application/x-mpegURL";

			const entries = media
				.map((entry) =>
					[
						`#EXTINF:-1,${entry.title || entry.url}`,
						(formatOptions
							? `${BASE_URL}/${formatOptions}/`
							: !entry.direct
							? `${BASE_URL}/`
							: "") + entry.url,
					].join("\n")
				)
				.join("\n");

			ctx.body = `#EXTM3U\n${entries}`;
		}
	} catch (e) {
		console.error(e);
	}
});

const PORT = process.env["PORT"] || 8080;
app.listen(PORT);
YTDLP.startHydrating();

console.log(`Listening at :${PORT}`);
