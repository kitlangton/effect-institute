#!/usr/bin/env bun
/**
 * Narration tooling CLI
 *
 * Usage: bun narrate <command>
 *
 * See `bun narrate --help` for available commands. Each command lives in ./commands.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node"
import { Effect, Layer } from "effect"
import { Command } from "effect/cli"
import { CourseService } from "@/backend/services"
import { buildCmd } from "./commands/build"
import { readCmd } from "./commands/read"
import { statsCmd } from "./commands/stats"
import { stepsCmd } from "./commands/steps"
import { wordsCmd } from "./commands/words"

const mainCmd = Command.make("narrate").pipe(
	Command.withDescription("Course content tooling for effect-institute"),
	Command.withSubcommands([buildCmd, wordsCmd, stepsCmd, readCmd, statsCmd]),
)

const CliLive = Layer.mergeAll(CourseService.defaultLayer, NodeServices.layer)

const cliApp = Command.run(mainCmd, {
	version: "0.1.0",
}).pipe(Effect.provide(CliLive))

NodeRuntime.runMain(cliApp as Effect.Effect<void, unknown, never>)
