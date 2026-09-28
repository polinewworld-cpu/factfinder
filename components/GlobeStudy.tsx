// Globe Study — Originkit

"use client"

import * as React from "react"
import { useEffect, useRef } from "react"

const MAX_DPR = 2
const FACE = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
const QA = Math.PI / 36
const MW = 288
const MH = 144

const LAND_B64 =
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPcBAOD/HwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACA" +
    "//+P//f/LwgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD4/v/4/////wcAAAAEAPABAAAAfAAAAAAAAAAAAAAAAAAAAADg9w/4" +
    "/////wEAAP4AAAAAAAAA+AAAAAAAAAAAAAAAAAAAAIAG+Of//////wAAAHwGAAAAAAAAAAMAAAAAAAAAAAAAAACABwAc/4P/////" +
    "/wAAADAAAAAAQAAAAD4AAAAAAAAAAAAAAAAAfMbDcQAA/v///wAAAAAAAADABwAA//8HAMAPAAAAAAAAAABgAAAAAAAA/P///wAA" +
    "AAAAAABwAADg//8AAAAAAAAAAAAAAADwG457dwcA8P//HwAAAAAAAAAYAAD///9/eAAAAAAAAAAAAAD4/g0H/w8A8P//PwAAAAAA" +
    "AAAOgOv/////fwD/AAAAAAA/AAAA/B84/v8A8P//LwAAAAD4AAAA4PP//////////wAAAOD///H/+D/3cPgDoP//DwAAAID/BwAA" +
    "x/v/////////P4AA/P///////////////////////w8AAOcBAAgAAAAAAAAAAAAAgP///////////////////////wcAACYAAAQA" +
    "AAAAAAAAAAAAgf///////////////////////wMM8AAAAAAAAAAAAAAAAAAAIID/////////e+wPwH8AgA8AAP/5z///////////" +
    "//////8/ANH///////9/AIALgD8AAAAAwH/+//////////////////9/APj///////8fADwAAD8AAAAA8D/+////////////////" +
    "//sPAPC/+f////8fAPwAADgAAAAA8D/+////////////////D/wBAMCfAP////8PAPwYAAAAAAAA8H/4//////////////9/DgcA" +
    "AAAcAOD///8/APw/AAAAAAAQAB7w//////////////8BgAMAAAACAMD/////Afh/AAAAAAA4gBz+/////////////38A4AMAAMAA" +
    "AMD/////B/z/AAAAAABwwAb+/////////////x8A8AEAAAAAAAD/////P///AwAAAADmgOH//////////////z8A4AAAAAAAAAD+" +
    "////P/7/BwAAAAD28P////////////////8D4AAAAAAAAAD8////f/7/BwAAAADz+f////////////////8HIAAAAAAAAAD6////" +
    "////BAAAAABw/v////////////////8EAAAAAAAAAADo//////8jHgAAAACA//////////////////8MAAAAAAAAAADQ//////8O" +
    "PgAAAADw//////////////////8AAAAAAAAAAADg//////+PIAAAAADA////v////////////38EAAAAAAAAAADg////////AAAA" +
    "AACA//v/zD/8/////////z8AAAAAAAAAAADg//////8bAAAAAACA//N/gD///////////x8GAAAAAAAAAADw//////8AAAAAAAD+" +
    "B8c/AD/+/////////wcPAAAAAAAAAADg//////8AAAAAAAD+gx4/DH74/////////wABAAAAAAAAAADg/////x8AAAAAAAD+gbCn" +
    "///8////////fQABAAAAAAAAAADg/////w8AAAAAAAD/gCDn///4//////9/MgADAAAAAAAAAADA/////w8AAAAAAAD+AADm/3/4" +
    "//////8/cIABAAAAAAAAAADA/////wcAAAAAAAA44AHC///5////////4+ABAAAAAAAAAACA/////wcAAAAAAACI/wEA4P//////" +
    "////4OgAAAAAAAAAAAAA/////wMAAAAAAAD4/wAA4P//////////ADYAAAAAAAAAAAAA/P///wEAAAAAAAD+/wEA8P//////////" +
    "AQcAAAAAAAAAAAAA+P//fwAAAAAAAAD//w8P8P//////////AQEAAAAAAAAAAAAAyP//fwAAAAAAAAD//3//////////////AQAA" +
    "AAAAAAAAAAAA0P+PYQAAAAAAAAD//////z//////////AwAAAAAAAAAAAAAAoP8HwAAAAAAAAMD/////83/+////////AQAAAAAA" +
    "AAAAAAAAIP8DwAAAAAAAAOD/////5//I////////AAAAAAAAAAAAAAAAQP4DgAAAAAAAAPD/////z/+A////////AAAAAAAAAAAA" +
    "AAAAAPwDAAIAAAAAAPD/////z/8ZwP////9/AQAAAAAAAAAAAAAAAPgDQAAAAAAAAPj/////j/9/gP////8fAQAAAAAAAAAAAAAA" +
    "APADEAMAAAAAAPz/////v///AP9//P8DAAAAAAAAAAAAAAAAAPADAwwAAAAAAPj/////P/9/APw//B8AAAAAAAAAAAAIAAAAAPCH" +
    "A8AAAAAAAPj/////P/4/APwP+J8BAAAAAAAAAAAAAAAAAMD/A0YEAAAAAPj/////f/4fAPwH+B8AAwAAAAAAAAAAAAAAAAD/AQAA" +
    "AAAAAPj/////f/wHAPgD8D8AAwAAAAAAAAAAAAAAAADgHwAAAAAAAPj///////wDAPgAwH8AAQAAAAAAAAAAAAAAAADAHwAAAAAA" +
    "APz//////30AAPAAwH8AAAAAAAAAAAAAAAAAAAAAHAAAAAAAAPj//////wsAAPAAgH4AAQAAAAAAAAAAAAAAAAAAGEAAAAAAAPj/" +
    "/////wMBAPAAgHwAAAAAAAAAAAAAAAAAAAAAGPAhAAAAAPD///////cBAOAAgDiABAAAAAAAAAAAAAAAAAAAIPl/AAAAAOD/////" +
    "//8AAGABABBAFAAAAAAAAAAAAAAAAAAAgP7/AQAAAMD///////8AAAABgAAAHAAAAAAAAAAAAAAAAAAAAPz/AQAAAID///////8A" +
    "AAABAAEgCAAAAAAAAAAAAAAAAAAAAPz/HwAAAAD/8P///38AAAAAAANgAAAAAAAAAAAAAAAAAAAAAPz/fwAAAAAAoP///z8AAAAA" +
    "YAd4AAAAAAAAAAAAAAAAAAAAAPz/fwAAAAAAAP///x8AAAAAwAY8AAAAAAAAAAAAAAAAAAAAAP7//wAAAAAAAP///w8AAAAAgAc+" +
    "AAAAAAAAAAAAAAAAAAAAAP///wAAAAAAAP///wcAAAAAgIM/TwAAAAAAAAAAAAAAAAAAAP///wEAAAAAgP///wMAAAAAAIc/QAQA" +
    "AAAAAAAAAAAAAAAAgP///w8AAAAAgP///wEAAAAAAA6fAUQAAAAAAAAAAAAAAAAAAP////8AAAAAAP///wAAAAAAAB6ewuwDAgAA" +
    "AAAAAAAAAAAAgP////8DAAAAAP7//wAAAAAAABwAAvAPAgAAAAAAAAAAAAAAgP////8PAAAAAPz/fwAAAAAAABAAAMCfAQAAAAAA" +
    "AAAAAAAAAP////8PAAAAAPz//wAAAAAAAOADAIA/MAAAAAAAAAAAAAAAAP7///8PAAAAAPz/fwAAAAAAAAAPAMBngAAAAAAAAAAA" +
    "AAAAAP7///8PAAAAAPz//wAAAAAAAAAACABAAAAAAAAAAAAAAAAAAPz///8HAAAAAPj//wAAAAAAAAAAAAAAAAIAAAAAAAAAAAAA" +
    "APz///8DAAAAAPj//wAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAPj///8BAAAAAPz//4AAAAAAAAAAAB8GAAAAAAAAAAAAAAAAAPj/" +
    "//8BAAAAAPz//8EAAAAAAAAAIB8OAAAAAAAAAAAAAAAAAPD///8BAAAAAP7//+AAAAAAAAAA+B8OACAAAAAAAAAAAAAAAMD///8B" +
    "AAAAAP7/f/gAAAAAAAAA/H8eAAAAAAAAAAAAAAAAAID///8AAAAAAP7/H/gAAAAAAAAA/P8fAABAAAAAAAAAAAAAAAD///8AAAAA" +
    "APz/D3AAAAAAAAAA/v8/AAAAAAAAAAAAAAAAAAD///8AAAAAAPj/D3gAAAAAAADA//9/AAgAAAAAAAAAAAAAAAD//38AAAAAAPj/" +
    "DzgAAAAAAADw////AAAAAAAAAAAAAAAAAAD//x8AAAAAAPD/DzgAAAAAAAD4////AQAAAAAAAAAAAAAAAAD//wMAAAAAAPD/DzgA" +
    "AAAAAAD4////AwAAAAAAAAAAAAAAAID//wEAAAAAAPD/AwAAAAAAAAD4////AwAAAAAAAAAAAAAAAID//wEAAAAAAPD/AwAAAAAA" +
    "AAD4////BwAAAAAAAAAAAAAAAID//wEAAAAAAOD/AwAAAAAAAAD4////BwAAAAAAAAAAAAAAAID//wAAAAAAAOD/AQAAAAAAAADw" +
    "////BwAAAAAAAAAAAAAAAID//wAAAAAAAMD/AAAAAAAAAADw////AwAAAAAAAAAAAAAAAID/fwAAAAAAAIB/AAAAAAAAAADgf/z/" +
    "AwAAAAAAAAAAAAAAAID/PwAAAAAAAIA/AAAAAAAAAADgB/D/AQAAAAAAAAAAAAAAAMD/HQAAAAAAAIABAAAAAAAAAADwAND/AQAA" +
    "AAAAAAAAAAAAAMD/AwAAAAAAAAAAAAAAAAAAAAAAAID/AAAIAAAAAAAAAAAAAMD/BwAAAAAAAAAAAAAAAAAAAAAAAAD/AAAQAAAA" +
    "AAAAAAAAAOD/AwAAAAAAAAAAAAAAAAAAAAAAAAA+AABwAAAAAAAAAAAAAOA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAA" +
    "AAAAAOA/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAOAPAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAGAAAAAAAAAAAA" +
    "AMAPAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAADAAAAAAAAAAAAAPAPAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMABAAAAAAAAAAAAAPAD" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAOABAAAAAAAAAAAAAPAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPAHAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPADAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAPABAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPCBAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGABAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMAHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAABAAAAAA" +
    "AAAAAAAAAAAAAAAcAAAAAAAAAAAAAAA+AABAAJ8//j8PAAAAAAAAAAAAAAAAAAAMAAAAAAAAAAAAAPD/fwD///////8/AAAAAAAA" +
    "AAAAAAAAAIA+AAAAAAAAAAAAPP///8D/////////HwAAAAAAAAAAAAAAAIA9AAAAAAAA8Pz/////P/j//////////wMAAAAAAAAA" +
    "AMAAAPB9AAAAAID/////////P/7///////////8BAAAAAAAAAOABAwB/AAAAAPD///////////////////////8AAAAAAFACPoD/" +
    "//9/AAAAAPD//////////////////////x8AAAAA+P////////8HAAAAAP///////////////////////wcAAAAA/v///////wMA" +
    "AAAA/v///////////////////////wcAAAD8/////////w8AAA7w/////////////////////////w8AAMAB/////////wMAgB84" +
    "/////////////////////////wEAAAAA/P///////3/w4AcA/////////////////////////wAAAADg//////////8/gM//////" +
    "/////////////////////wMAAADg/////////////f///////////////////////////z8A7wMA/v//////////////////////" +
    "//////////////////8/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" +
    "AAAAAAAAAAAA"

function num(v: unknown, fb: number): number {
    return typeof v === "number" && isFinite(v) ? v : fb
}

function clampN(v: number, lo: number, hi: number): number {
    return v < lo ? lo : v > hi ? hi : v
}

function parseRGB(input: string | undefined, fb: [number, number, number]): [number, number, number] {
    if (!input) return fb
    const str = String(input).trim()
    if (str.charAt(0) === "#") {
        let hex = str.slice(1)
        if (hex.length === 3 || hex.length === 4) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
        }
        if (hex.length >= 6) {
            const r = parseInt(hex.slice(0, 2), 16)
            const g = parseInt(hex.slice(2, 4), 16)
            const b = parseInt(hex.slice(4, 6), 16)
            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) return [r, g, b]
        }
        return fb
    }
    const m = str.match(/[\d.]+/g)
    if (m && m.length >= 3) return [+m[0], +m[1], +m[2]]
    return fb
}

type Node = { lat: number; lon: number; land: boolean; c: string }

interface GlobeGroup {
    radius?: number
    drift?: number
    letters?: number
}
const GLOBE_DEFAULTS: Required<GlobeGroup> = { radius: 100, drift: 210, letters: 100 }

interface PointerGroup {
    zoom?: number
    light?: number
    pins?: number
}
const POINTER_DEFAULTS: Required<PointerGroup> = { zoom: 100, light: 100, pins: 7 }

interface Props {
    style?: React.CSSProperties
    width?: number
    height?: number
    background?: string
    baseColor?: string
    phrase?: string
    density?: number
    glyphSize?: number
    speed?: number
    hover?: number
    globe?: GlobeGroup
    pointer?: PointerGroup
}

function __OriginkitBase_GlobeStudy(props: Props) {
    const {
        style,
        background = "#0B0C0E",
        baseColor = "#E2E4E9",
        phrase = "everypointonthisballisapathbacktoanotherone",
        density = 53,
        glyphSize = 90,
        speed = 100,
        hover = 100,
        globe,
        pointer,
        width,
        height,
    } = props

    const globe_ = { ...GLOBE_DEFAULTS, ...(globe || {}) }
    const pointer_ = { ...POINTER_DEFAULTS, ...(pointer || {}) }

    const canvasRef = useRef<HTMLCanvasElement>(null)
    const sizeRef = useRef({ w: 0, h: 0 })
    sizeRef.current = { w: num(width, 0), h: num(height, 0) }

    const ptrRef = useRef({
        on: 0,
        x: -1e9,
        y: -1e9,
        dragging: 0,
        dx: 0,
        dy: 0,
        moved: 0,
        click: 0,
    })

    const vRef = useRef<Record<string, number | string>>({})
    vRef.current = {
        base: baseColor,
        phrase: String(phrase || "").length ? String(phrase) : "globe",
        density: clampN(num(density, 100), 40, 200) / 100,
        glyphSize: clampN(num(glyphSize, 100), 20, 300) / 100,
        speed: clampN(num(speed, 50), 0, 100) / 50,
        hover: clampN(num(hover, 100), 0, 200) / 100,
        radius: clampN(num(globe_.radius, 100), 40, 200) / 100,
        drift: clampN(num(globe_.drift, 100), 0, 400) / 100,
        letters: clampN(num(globe_.letters, 100), 0, 200) / 100,
        zoom: clampN(num(pointer_.zoom, 100), 0, 300) / 100,
        light: clampN(num(pointer_.light, 100), 0, 300) / 100,
        pins: Math.round(clampN(num(pointer_.pins, 7), 0, 24)),
    }

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext("2d")
        if (!ctx) {
            console.error("GlobeStudy: 2D context unavailable")
            return
        }

        let land: Uint8Array | null = null
        try {
            const bin = atob(LAND_B64)
            land = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) land[i] = bin.charCodeAt(i)
        } catch {
            land = null
        }
        const isLand = (lon: number, lat: number) => {
            if (!land) return false
            const gx = Math.floor(((lon + 180) / 360) * MW)
            const gy = Math.floor(((90 - lat) / 180) * MH)
            if (gx < 0 || gx >= MW || gy < 0 || gy >= MH) return false
            const b = gy * MW + gx
            return ((land[b >> 3] >> (b & 7)) & 1) === 1
        }

        let nodes: Node[] = []
        let builtKey = ""
        const build = (dens: number, letterK: number, text: string) => {
            const step = 3.05 / dens
            nodes = []
            let k = 0
            let run = 0
            let sea3 = 0
            const every = letterK <= 0 ? 0 : Math.max(1, Math.round(2 / letterK))
            for (let lat = -86; lat <= 86; lat += step) {
                const rl = Math.cos((lat * Math.PI) / 180)
                const n = Math.max(1, Math.round(98 * dens * rl))
                for (let i = 0; i < n; i++) {
                    const lon = -180 + (360 * i) / n
                    const l = isLand(lon, lat)
                    if (!l && sea3++ % 2) continue
                    let letter = ""
                    if (l && every && run++ % every === 0) letter = text.charAt(k++ % text.length)
                    nodes.push({ lat: (lat * Math.PI) / 180, lon: (lon * Math.PI) / 180, land: l, c: letter })
                }
            }
            builtKey = dens + "|" + letterK + "|" + text
        }

        const pins: { lat: number; lon: number; t: number }[] = []
        const view = { cx: 0, cy: 0, R: 1, cs: 1, sn: 0, ct: 1, st: 0 }

        const unproject = (px: number, py: number) => {
            const x1 = (px - view.cx) / view.R
            const y2 = (view.cy - py) / view.R
            const q = 1 - x1 * x1 - y2 * y2
            if (q <= 0.002) return null
            const z2 = Math.sqrt(q)
            const y0 = y2 * view.ct + z2 * view.st
            const z1 = -y2 * view.st + z2 * view.ct
            const x0 = x1 * view.cs + z1 * view.sn
            const z0 = -x1 * view.sn + z1 * view.cs
            return { lat: Math.asin(clampN(y0, -1, 1)), lon: Math.atan2(z0, x0) }
        }

        let raf = 0
        let last = performance.now()
        let clock = 0
        let spin = 2.1
        let vel = 0.16
        let tilt = -0.36
        let vtilt = 0
        let zoom = 1
        let zoomT = 1
        let seenClick = 0
        const sea: number[] = []
        const soil: number[] = []
        const land8: number[][] = []

        const render = (now: number) => {
            const dt = Math.min(0.05, (now - last) / 1000)
            last = now
            const v = vRef.current
            const sp = v.speed as number
            clock += dt * sp

            const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
            const cw = sizeRef.current.w || canvas.clientWidth || 1200
            const ch = sizeRef.current.h || canvas.clientHeight || 800
            const bw = Math.max(1, Math.round(cw * dpr))
            const bh = Math.max(1, Math.round(ch * dpr))
            if (canvas.width !== bw || canvas.height !== bh) {
                canvas.width = bw
                canvas.height = bh
            }

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            ctx.clearRect(0, 0, cw, ch)

            const key = (v.density as number) + "|" + (v.letters as number) + "|" + (v.phrase as string)
            if (key !== builtKey) build(v.density as number, v.letters as number, v.phrase as string)

            const u = Math.min(cw, ch)
            const ptr = ptrRef.current
            const hv = (v.hover as number) * (ptr.on ? 1 : 0)

            zoom += (zoomT - zoom) * Math.min(1, dt / 0.18)

            const cx = cw / 2
            const cy = ch / 2 + u * 0.035
            const R = u * 0.318 * zoom * (v.radius as number)
            const fs = u * 0.0275 * Math.pow(zoom, 0.72) * (v.glyphSize as number)

            if (ptr.dragging) {
                const dspin = (ptr.dx * u) / R
                const dtilt = (-ptr.dy * u) / R
                ptr.dx = 0
                ptr.dy = 0
                spin += dspin
                tilt = clampN(tilt + dtilt, -1.15, 1.15)

                const k = Math.min(1, dt / 0.07)
                const inv = 1 / Math.max(dt, 1 / 240)
                vel += (clampN(dspin * inv, -9, 9) - vel) * k
                vtilt += (clampN(dtilt * inv, -9, 9) - vtilt) * k
            } else {
                const idle = 0.16 * (v.drift as number) * (hv > 0 ? 0.28 : 1)
                vel += (idle - vel) * Math.min(1, (dt * sp) / 0.9)
                vtilt *= Math.exp(-dt * sp * 6.6)
                tilt = clampN(tilt + vtilt * dt * sp, -1.15, 1.15)
                tilt += (-0.36 - tilt) * Math.min(1, (dt * sp) / 4)
                spin += vel * dt * sp
            }

            if (ptr.click !== seenClick) {
                seenClick = ptr.click
                const g = unproject(ptr.x, ptr.y)
                const cap = v.pins as number
                if (g && cap > 0) {
                    pins.push({ lat: g.lat, lon: g.lon, t: clock })
                    while (pins.length > cap) pins.shift()
                }
            }

            const cs = Math.cos(spin)
            const sn = Math.sin(spin)
            const ct = Math.cos(tilt)
            const st = Math.sin(tilt)
            view.cx = cx
            view.cy = cy
            view.R = R
            view.cs = cs
            view.sn = sn
            view.ct = ct
            view.st = st

            const lightK = (v.light as number) * hv
            const lx = lightK > 0 && !ptr.dragging ? ptr.x : -1e9
            const ly = lightK > 0 && !ptr.dragging ? ptr.y : -1e9
            const lr = u * 0.2
            const lr2 = lr * lr

            const ink = parseRGB(v.base as string, [226, 228, 233])
            const rgb = ink[0] + "," + ink[1] + "," + ink[2]
            const tone = (a: number) => "rgba(" + rgb + "," + clampN(a, 0, 1).toFixed(3) + ")"

            ctx.textAlign = "center"
            ctx.textBaseline = "middle"

            sea.length = 0
            soil.length = 0
            for (let bi = 0; bi < 8; bi++) if (land8[bi]) land8[bi].length = 0

            for (let i = 0; i < nodes.length; i++) {
                const nd = nodes[i]
                const cl = Math.cos(nd.lat)
                const x0 = cl * Math.cos(nd.lon)
                const y0 = Math.sin(nd.lat)
                const z0 = cl * Math.sin(nd.lon)
                const x1 = x0 * cs - z0 * sn
                const z1 = x0 * sn + z0 * cs
                const y2 = y0 * ct - z1 * st
                const z2 = y0 * st + z1 * ct
                if (z2 <= 0.02) continue

                const px = cx + x1 * R
                const py = cy - y2 * R
                const ddx = px - lx
                const ddy = py - ly
                const glow = ddx * ddx + ddy * ddy < lr2 ? (1 - Math.sqrt(ddx * ddx + ddy * ddy) / lr) * lightK : 0
                if (!nd.land) {
                    sea.push(px, py, Math.min(0.999, z2 + glow * 0.55))
                    continue
                }
                if (!nd.c) {
                    soil.push(px, py, Math.min(0.999, z2 + glow * 0.55))
                    continue
                }

                const tx0 = -Math.sin(nd.lon)
                const tz0 = Math.cos(nd.lon)
                const tx1 = tx0 * cs - tz0 * sn
                const tz1 = tx0 * sn + tz0 * cs
                const ang = Math.round(Math.atan2(tz1 * st, tx1) / QA) * QA
                const b = Math.min(7, Math.max(0, (Math.min(0.999, z2 + glow * 0.6) * 7.99) | 0))
                ;(land8[b] || (land8[b] = [])).push(px, py, ang, i)
            }

            const dmin = Math.max(0.7, u * 0.0029)
            const dots = (list: number[], baseA: number, gain: number, grow: number) => {
                for (let lvl = 0; lvl < 6; lvl++) {
                    const z = (lvl + 0.5) / 6
                    const dsz = dmin * grow * (0.55 + 0.75 * z)
                    ctx.fillStyle = tone(baseA + gain * z)
                    ctx.beginPath()
                    for (let q = 0; q < list.length; q += 3) {
                        const lv = list[q + 2] >= 1 ? 5 : (list[q + 2] * 6) | 0
                        if (lv !== lvl) continue
                        ctx.rect(list[q] - dsz / 2, list[q + 1] - dsz / 2, dsz, dsz)
                    }
                    ctx.fill()
                }
            }
            dots(sea, 0.1, 0.22, 1.0)
            dots(soil, 0.34, 0.46, 1.7)

            for (let bi = 0; bi < 8; bi++) {
                const arr = land8[bi]
                if (!arr || !arr.length) continue
                const zb = (bi + 0.5) / 8
                ctx.font = "bold " + (fs * (0.42 + 0.58 * zb)).toFixed(2) + "px " + FACE
                ctx.fillStyle = tone(0.28 + 0.72 * Math.pow(zb, 0.6))
                for (let t = 0; t < arr.length; t += 4) {
                    ctx.save()
                    ctx.translate(arr[t], arr[t + 1])
                    ctx.rotate(arr[t + 2])
                    ctx.fillText(nodes[arr[t + 3]].c, 0, 0)
                    ctx.restore()
                }
            }

            for (let pi = 0; pi < pins.length; pi++) {
                const pn = pins[pi]
                const pcl = Math.cos(pn.lat)
                const ax = pcl * Math.cos(pn.lon)
                const ay = Math.sin(pn.lat)
                const az = pcl * Math.sin(pn.lon)
                const bx1 = ax * cs - az * sn
                const bz1 = ax * sn + az * cs
                const by2 = ay * ct - bz1 * st
                const bz2 = ay * st + bz1 * ct
                if (bz2 <= 0.02) continue
                const ppx = cx + bx1 * R
                const ppy = cy - by2 * R
                const age = clock - pn.t
                const pop = Math.min(1, age / 0.22)
                const rr2 = u * 0.016 * (0.4 + 0.6 * pop) * (0.55 + 0.45 * bz2)
                ctx.beginPath()
                ctx.arc(ppx, ppy, rr2, 0, Math.PI * 2)
                ctx.strokeStyle = tone(0.3 + 0.55 * bz2)
                ctx.lineWidth = Math.max(0.7, u * 0.0022)
                ctx.stroke()
                ctx.beginPath()
                ctx.arc(ppx, ppy, Math.max(0.7, rr2 * 0.22), 0, Math.PI * 2)
                ctx.fillStyle = tone(0.45 + 0.55 * bz2)
                ctx.fill()
                if (age < 0.9) {
                    const w2 = 1 - age / 0.9
                    ctx.beginPath()
                    ctx.arc(ppx, ppy, rr2 + (1 - w2) * u * 0.05, 0, Math.PI * 2)
                    ctx.strokeStyle = tone(0.55 * w2 * w2)
                    ctx.lineWidth = Math.max(0.6, u * 0.0016)
                    ctx.stroke()
                }
            }

            raf = requestAnimationFrame(render)
        }

        let lastX = 0
        let lastY = 0
        const localPoint = (e: PointerEvent) => {
            const r = canvas.getBoundingClientRect()
            if (r.width <= 0 || r.height <= 0) return null
            const cw = sizeRef.current.w || canvas.clientWidth || 1200
            const ch = sizeRef.current.h || canvas.clientHeight || 800
            return { x: ((e.clientX - r.left) / r.width) * cw, y: ((e.clientY - r.top) / r.height) * ch }
        }
        const track = (e: PointerEvent) => {
            const p = localPoint(e)
            if (!p) return
            const ptr = ptrRef.current
            ptr.on = 1
            if (ptr.dragging) {
                const u = Math.min(sizeRef.current.w || 1200, sizeRef.current.h || 800)
                ptr.dx += (p.x - lastX) / u
                ptr.dy += (p.y - lastY) / u
                ptr.moved = 1
            }
            ptr.x = p.x
            ptr.y = p.y
            lastX = p.x
            lastY = p.y
        }
        const onDown = (e: PointerEvent) => {
            const p = localPoint(e)
            if (!p) return
            const ptr = ptrRef.current
            ptr.dragging = 1
            ptr.moved = 0
            ptr.x = p.x
            ptr.y = p.y
            lastX = p.x
            lastY = p.y
            try {
                canvas.setPointerCapture(e.pointerId)
            } catch {
            }
        }

        const onUp = () => {
            const ptr = ptrRef.current
            if (ptr.dragging && !ptr.moved) ptr.click++
            ptr.dragging = 0
        }
        const onLeave = () => {
            if (!ptrRef.current.dragging) ptrRef.current.on = 0
        }
        const onWheel = (e: WheelEvent) => {
            const v = vRef.current
            if ((v.zoom as number) <= 0) return
            e.preventDefault()
            zoomT = clampN(zoomT * Math.exp(-e.deltaY * 0.0016 * (v.zoom as number)), 0.85, 2.6)
        }

        canvas.addEventListener("pointermove", track)
        canvas.addEventListener("pointerenter", track)
        canvas.addEventListener("pointerleave", onLeave)
        canvas.addEventListener("pointerdown", onDown)
        window.addEventListener("pointerup", onUp)
        window.addEventListener("pointercancel", onUp)
        canvas.addEventListener("wheel", onWheel, { passive: false })
        raf = requestAnimationFrame(render)

        return () => {
            cancelAnimationFrame(raf)
            canvas.removeEventListener("pointermove", track)
            canvas.removeEventListener("pointerenter", track)
            canvas.removeEventListener("pointerleave", onLeave)
            canvas.removeEventListener("pointerdown", onDown)
            window.removeEventListener("pointerup", onUp)
            window.removeEventListener("pointercancel", onUp)
            canvas.removeEventListener("wheel", onWheel)
        }
    }, [])

    return (
        <div
            style={{
                position: "relative",
                overflow: "hidden",
                background,
                minWidth: 1200,
                minHeight: 800,
                width: typeof width === "number" && width > 0 ? width : "100%",
                height: typeof height === "number" && height > 0 ? height : "100%",
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    display: "block",

                    touchAction: "none",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                }}
            />
        </div>
    )
}

const __originkitPresetProps = {
  "globe": {
    "drift": 210,
    "radius": 100,
    "letters": 100
  },
  "pointer": {
    "pins": 7,
    "zoom": 100,
    "light": 100
  }
};

export default function GlobeStudy(props: Record<string, unknown>) {
  return <__OriginkitBase_GlobeStudy {...(__originkitPresetProps as Record<string, unknown>)} {...props} />;
}
