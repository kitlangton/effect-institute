#!/usr/bin/env bun
/**
 * Narration tooling CLI
 *
 * Usage: bun narrate <command>
 *
 * See `bun narrate --help` for available commands. Each command lives in ./commands.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Console, Effect, Layer } from "effect"
import { Command } from "effect/cli"
import { Narration } from "@/authoring/server/Narration"
import { CourseService } from "@/backend/services"
import { AppConfig } from "@/backend/services/AppConfig"
import { alignCmd } from "./commands/align"
import { buildCmd } from "./commands/build"
import { doctorCmd } from "./commands/doctor"
import { generateCmd } from "./commands/generate"
import { newCmd } from "./commands/new"
import { readCmd } from "./commands/read"
import { recordCmd } from "./commands/record"
import { statsCmd } from "./commands/stats"
import { stepsCmd } from "./commands/steps"
import { wordsCmd } from "./commands/words"

const mainCmd = Command.make("narrate").pipe(
	Command.withDescription("Course content tooling for effect-institute"),
	Command.withSubcommands([
		buildCmd,
		wordsCmd,
		stepsCmd,
		readCmd,
		statsCmd,
		newCmd,
		recordCmd,
		alignCmd,
		generateCmd,
		doctorCmd,
	]),
)

// No layer here reads an API key at startup; keys are read only when align or generate calls ElevenLabs.
const CliLive = Layer.mergeAll(
	CourseService.defaultLayer,
	Narration.defaultLayer,
	AppConfig.defaultLayer,
	NodeServices.layer,
)

const cliApp = Command.run(mainCmd, {
	version: "0.1.0",
}).pipe(
	Effect.provide(CliLive),
	// Expected failures (missing key, missing audio, bad IDs) print one line instead of a stack trace.
	Effect.catch((error: unknown) =>
		Console.error(`\nerror: ${error instanceof Error ? error.message : String(error)}`).pipe(
			Effect.andThen(
				Effect.sync(() => {
					process.exitCode = 1
				}),
			),
		),
	),
)

NodeRuntime.runMain(cliApp as Effect.Effect<void, unknown, never>)
