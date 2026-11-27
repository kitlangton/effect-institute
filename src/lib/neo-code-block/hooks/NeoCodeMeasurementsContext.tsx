"use client"

import React from "react"
import type { NeoCodeMeasurementsManager } from "./NeoCodeMeasurementsManager"

const NeoCodeMeasurementsContext = React.createContext<NeoCodeMeasurementsManager | null>(null)

export function NeoCodeMeasurementsProvider({
	manager,
	children,
}: {
	manager: NeoCodeMeasurementsManager
	children: React.ReactNode
}) {
	return <NeoCodeMeasurementsContext.Provider value={manager}>{children}</NeoCodeMeasurementsContext.Provider>
}

export function useNeoCodeMeasurementsManager() {
	return React.useContext(NeoCodeMeasurementsContext)
}
