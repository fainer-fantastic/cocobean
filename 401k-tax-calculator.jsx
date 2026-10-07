import { useState, useMemo } from "react";

const BRACKETS = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  married: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
  hoh: [
    { min: 0, max: 16550, rate: 0.10 },
    { min: 16550, max: 63100, rate: 0.12 },
    { min: 63100, max: 100500, rate: 0.22 },
    { min: 100500, max: 191950, rate: 0.24 },
    { min: 191950, max: 243700, rate: 0.32 },
    { min: 243700, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
};

const STD_DED = { single: 14600, married: 29200, hoh: 21900 };

function calcFedTax(income, status) {
  const brackets = BRACKETS[status];
  let tax = 0, rem = income;
  for (const b of brackets) {
    if (rem <= 0) break;
    const taxable = Math.min(rem, b.max - b.min);
    tax += taxable * b.rate;
    rem -= taxable;
  }
  return Math.max(0, tax);
}

function getMarginal(income, status) {
  for (const b of BRACKETS[status]) {
    if (income >= b.min && income < b.max) return b.rate;
  }
  return BRACKETS[status].at(-1).rate;
}

function calcScenario(gross, status, traditional, roth) {
  const stdDed = STD_DED[status];
  const taxableIncome = Math.max(0, gross - traditional - stdDed);
  const federalTax = calcFedTax(taxableIncome, status);
  const fica = gross * 0.0765;
  const totalContrib = traditional + roth;
  const takeHome = gross - federalTax - fica - totalContrib;
  return {
    taxableIncome,
    federalTax,
    fica,
    traditional,
    roth,
    totalContrib,
    takeHome,
    perCheck: takeHome / 24,
    marginalRate: getMarginal(taxableIncome, status),
  };
}

const fmt = (n, sign = false) => {
  const abs = `$${Math.abs(Math.round(n)).toLocaleString()}`;
  if (sign) return n >= 0 ? `+${abs}` : `-${abs}`;
  return n < 0 ? `-${abs}` : abs;
};
const pct = (n) => `${(n * 100).toFixed(0)}%`;

export default function App() {
  const [gross, setGross] = useState(85000);
  const [status, setStatus] = useState("single");
  const [baseContrib, setBaseContrib] = useState(23000);
  const [scenContrib, setScenContrib] = useState(20000);
  const [rothPct, setRothPct] = useState(50);

  const MAX = 69000;

  const base = useMemo(() => calcScenario(gross, status, baseContrib, 0), [gross, status, baseContrib]);

  const scen = useMemo(() => {
    const trad = Math.round(scenContrib * (1 - rothPct / 100));
    return calcScenario(gross, status, trad, scenContrib - trad);
  }, [gross, status, scenContrib, rothPct]);

  const noContribFedTax = useMemo(
    () => calcFedTax(Math.max(0, gross - STD_DED[status]), status),
    [gross, status]
  );

  // Max roth% at scenContrib that keeps takeHome >= base.takeHome
  const maxRothSameCheck = useMemo(() => {
    for (let p = 100; p >= 0; p--) {
      const t = Math.round(scenContrib * (1 - p / 100));
      const s = calcScenario(gross, status, t, scenContrib - t);
      if (s.takeHome >= base.takeHome - 1) return p;
    }
    return 0;
  }, [gross, status, scenContrib, base.takeHome]);

  const checkDiff = scen.takeHome - base.takeHome;
  const checkDiffPerPay = checkDiff / 24;
  const taxDiff = scen.federalTax - base.federalTax;
  const contribDiff = scen.totalContrib - base.totalContrib;

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#0f172a", minHeight: "100vh", color: "#e2e8f0", padding: "24px 16px" }}>
      <div style={{ maxWidth: 840, margin: "0 auto" }}>

        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>401(k) Paycheck Impact Calculator</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "5px 0 0" }}>
            Change how much you contribute and how much goes to Roth — see the exact effect on your paycheck
          </p>
        </div>

        {/* Personal Info */}
        <div style={card}>
          <Label>Your Info</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <FieldLabel>Gross Annual Salary</FieldLabel>
              <PrefixInput prefix="$">
                <input type="number" value={gross} onChange={e => setGross(+e.target.value)} style={inputSt} />
              </PrefixInput>
            </div>
            <div>
              <FieldLabel>Filing Status</FieldLabel>
              <select value={status} onChange={e => setStatus(e.target.value)} style={inputSt}>
                <option value="single">Single</option>
                <option value="married">Married Filing Jointly</option>
                <option value="hoh">Head of Household</option>
              </select>
            </div>
          </div>
        </div>

        {/* Two column comparison */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>

          {/* BASELINE */}
          <div style={{ ...card, borderColor: "#1e4d3a" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#34d399" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: "0.08em" }}>Baseline</span>
            </div>

            <FieldLabel>Total Contribution / yr (all Traditional)</FieldLabel>
            <PrefixInput prefix="$">
              <input
                type="number" value={baseContrib} max={MAX}
                onChange={e => setBaseContrib(Math.min(MAX, Math.max(0, +e.target.value)))}
                style={inputSt}
              />
            </PrefixInput>
            <div style={{ fontSize: 11, color: "#475569", margin: "4px 0 14px" }}>
              IRS 2024 employee limit: $23,000 ($30,500 if 50+)
            </div>

            <Divider />
            <StatRow label="Taxable Income" val={fmt(base.taxableIncome)} />
            <StatRow label="Federal Tax" val={fmt(base.federalTax)} />
            <StatRow label="FICA (est.)" val={fmt(base.fica)} />
            <StatRow label="401k Tax Savings" val={fmt(noContribFedTax - base.federalTax)} color="#34d399" />
            <StatRow label="Marginal Rate" val={pct(base.marginalRate)} />
            <Divider />
            <StatRow label="401k Contribution" val={fmt(base.totalContrib)} />
            <StatRow label="Take-Home / yr" val={fmt(base.takeHome)} big />
            <StatRow label="Per Paycheck (÷24)" val={fmt(base.perCheck)} big color="#34d399" />
          </div>

          {/* SCENARIO */}
          <div style={{ ...card, borderColor: Math.abs(checkDiff) < 2 ? "#334155" : checkDiff > 0 ? "#166534" : "#7f1d1d" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#818cf8" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#818cf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Your Scenario</span>
            </div>

            {/* Total contrib slider */}
            <FieldLabel>Total Contribution / yr</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <input type="range" min={0} max={MAX} step={500} value={scenContrib}
                onChange={e => setScenContrib(+e.target.value)}
                style={{ flex: 1, accentColor: "#818cf8", cursor: "pointer" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#818cf8", minWidth: 72, textAlign: "right" }}>
                {fmt(scenContrib)}
              </span>
            </div>
            <div style={{ fontSize: 11, marginBottom: 14, color: contribDiff === 0 ? "#475569" : contribDiff > 0 ? "#fb923c" : "#4ade80" }}>
              {contribDiff === 0 ? "Same as baseline" : `${fmt(Math.abs(contribDiff))} ${contribDiff > 0 ? "more" : "less"} than baseline`}
            </div>

            {/* Roth % slider */}
            <FieldLabel>Roth Percentage</FieldLabel>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <input type="range" min={0} max={100} step={5} value={rothPct}
                onChange={e => setRothPct(+e.target.value)}
                style={{ flex: 1, accentColor: "#c084fc", cursor: "pointer" }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: "#c084fc", minWidth: 48, textAlign: "right" }}>
                {rothPct}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 12 }}>
                <span style={{ color: "#64748b" }}>Trad: </span>
                <span style={{ color: "#34d399", fontWeight: 600 }}>{fmt(scen.traditional)}</span>
              </span>
              <span style={{ fontSize: 12 }}>
                <span style={{ color: "#64748b" }}>Roth: </span>
                <span style={{ color: "#c084fc", fontWeight: 600 }}>{fmt(scen.roth)}</span>
              </span>
            </div>

            <Divider />
            <StatRow label="Taxable Income" val={fmt(scen.taxableIncome)} diff={scen.taxableIncome - base.taxableIncome} flipColor />
            <StatRow label="Federal Tax" val={fmt(scen.federalTax)} diff={taxDiff} flipColor />
            <StatRow label="FICA (est.)" val={fmt(scen.fica)} />
            <StatRow label="401k Tax Savings" val={fmt(noContribFedTax - scen.federalTax)} color="#34d399" />
            <StatRow label="Marginal Rate" val={pct(scen.marginalRate)} />
            <Divider />
            <StatRow label="401k Contribution" val={fmt(scen.totalContrib)} diff={contribDiff} flipColor />
            <StatRow label="Take-Home / yr" val={fmt(scen.takeHome)} big diff={checkDiff} />
            <StatRow label="Per Paycheck (÷24)" val={fmt(scen.perCheck)} big
              color={Math.abs(checkDiff) < 2 ? "#94a3b8" : checkDiff > 0 ? "#4ade80" : "#f87171"} />
          </div>
        </div>

        {/* Paycheck impact banner */}
        <div style={{
          borderRadius: 14, padding: "20px 24px", marginBottom: 16,
          background: Math.abs(checkDiff) < 2 ? "#0d1f2d" : checkDiff > 0 ? "#0b1f13" : "#1a0e0e",
          border: `1px solid ${Math.abs(checkDiff) < 2 ? "#1e4d6b" : checkDiff > 0 ? "#166534" : "#7f1d1d"}`,
          display: "flex", flexWrap: "wrap", gap: 20, alignItems: "center", justifyContent: "space-between"
        }}>
          <div>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>Paycheck change vs. baseline</div>
            <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1, color: Math.abs(checkDiff) < 2 ? "#94a3b8" : checkDiff > 0 ? "#4ade80" : "#f87171" }}>
              {Math.abs(checkDiff) < 2 ? "No Change" : fmt(Math.abs(checkDiffPerPay))}
              {Math.abs(checkDiff) >= 2 &&
                <span style={{ fontSize: 14, fontWeight: 400, color: "#64748b" }}> / paycheck {checkDiff > 0 ? "more" : "less"}</span>
              }
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 5 }}>
              {Math.abs(checkDiff) >= 2 && `${fmt(Math.abs(checkDiff))} ${checkDiff > 0 ? "more" : "less"} per year`}
              {Math.abs(checkDiff) < 2 && "Your take-home pay stays the same"}
            </div>
          </div>

          <div style={{ background: "#0f172a", borderRadius: 12, padding: "14px 20px", minWidth: 220, textAlign: "center" }}>
            <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>
              Max Roth % at {fmt(scenContrib)} total without shrinking paycheck below baseline
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#818cf8" }}>{maxRothSameCheck}%</div>
            <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
              <span style={{ color: "#c084fc" }}>{fmt(Math.round(scenContrib * maxRothSameCheck / 100))} Roth</span>
              {" + "}
              <span style={{ color: "#34d399" }}>{fmt(scenContrib - Math.round(scenContrib * maxRothSameCheck / 100))} Traditional</span>
            </div>
          </div>
        </div>

        {/* Breakdown tiles */}
        <div style={{ ...card }}>
          <Label>What's Driving the Difference</Label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 14 }}>
            <Tile
              label="Tax change"
              val={fmt(taxDiff, true)}
              sub={taxDiff > 0 ? "Paying more in taxes now (Roth shift reduces deduction)" : taxDiff < 0 ? "Tax savings from lower traditional contrib" : "No tax change"}
              color={taxDiff <= 0 ? "#4ade80" : "#f87171"}
            />
            <Tile
              label="Contribution change"
              val={fmt(contribDiff, true)}
              sub={contribDiff < 0 ? "Freeing up cash by investing less" : contribDiff > 0 ? "Investing more — less cash now" : "Same amount going in"}
              color={contribDiff === 0 ? "#94a3b8" : contribDiff < 0 ? "#fb923c" : "#818cf8"}
            />
            <Tile
              label="Roth invested"
              val={fmt(scen.roth)}
              sub="Grows completely tax-free — no tax on gains or withdrawals in retirement"
              color="#c084fc"
            />
          </div>

          <div style={{ background: "#0f172a", borderRadius: 10, padding: "14px 18px", fontSize: 13, color: "#94a3b8", lineHeight: 1.85 }}>
            <Insight {...{ gross, scen, base, checkDiff, taxDiff, contribDiff, maxRothSameCheck, noContribFedTax }} />
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#334155", marginTop: 16 }}>
          2024 federal brackets + standard deduction only. Excludes state taxes, employer match, HSA, and other pre-tax deductions.
        </div>
      </div>
    </div>
  );
}

function Insight({ scen, base, checkDiff, taxDiff, contribDiff, maxRothSameCheck }) {
  const pieces = [];

  if (contribDiff < -1) pieces.push(
    <span key="a">You're investing <strong style={{ color: "#fb923c" }}>{fmt(Math.abs(contribDiff))} less per year</strong> than your baseline — that directly frees up cash in your paycheck regardless of the Roth/traditional split. </span>
  );
  if (contribDiff > 1) pieces.push(
    <span key="a">You're investing <strong style={{ color: "#818cf8" }}>{fmt(contribDiff)} more per year</strong> than your baseline, which is why your paycheck shrinks even before Roth is factored in. </span>
  );

  if (scen.roth > 0) pieces.push(
    <span key="b">
      Of your {fmt(scen.totalContrib)} total, <strong style={{ color: "#c084fc" }}>{fmt(scen.roth)} goes into Roth</strong> (no upfront deduction), which costs you{" "}
      <strong style={{ color: "#f87171" }}>{fmt(scen.traditional > 0 ? base.marginalRate * scen.roth : Math.abs(taxDiff))} more in taxes today</strong>{" "}
      but that money — and all its growth — will never be taxed again.{" "}
    </span>
  );

  if (scen.traditional > 0) pieces.push(
    <span key="c">Your remaining <strong style={{ color: "#34d399" }}>{fmt(scen.traditional)} in Traditional</strong> still gives you a tax deduction at your <strong style={{ color: "#34d399" }}>{pct(scen.marginalRate)} marginal rate</strong>, saving {fmt(scen.traditional * scen.marginalRate)} in taxes this year. </span>
  );

  if (maxRothSameCheck === 100) pieces.push(
    <span key="d" style={{ color: "#4ade80" }}>✓ At this contribution level, you can go <strong>100% Roth</strong> without your paycheck dropping below baseline. </span>
  );
  else if (maxRothSameCheck > 0) pieces.push(
    <span key="d">You could shift up to <strong style={{ color: "#818cf8" }}>{maxRothSameCheck}% Roth</strong> at this contribution level and still keep your paycheck at or above baseline. </span>
  );

  return pieces.length ? pieces : <span>Adjust the sliders above to see a personalized breakdown.</span>;
}

// ── UI Primitives ──

const card = {
  background: "#1e293b",
  borderRadius: 14,
  padding: 20,
  marginBottom: 16,
  border: "1px solid #334155",
};

const inputSt = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "9px 10px",
  color: "#f1f5f9",
  fontSize: 14,
  boxSizing: "border-box",
};

function Label({ children }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>{children}</div>;
}

function FieldLabel({ children }) {
  return <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 5 }}>{children}</div>;
}

function PrefixInput({ prefix, children }) {
  return (
    <div style={{ position: "relative" }}>
      {prefix && <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#475569", fontSize: 13, pointerEvents: "none", zIndex: 1 }}>{prefix}</span>}
      <div style={{ paddingLeft: prefix ? 18 : 0 }}>{children}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid #1e3a5f", margin: "10px 0" }} />;
}

function StatRow({ label, val, diff, big, color, flipColor }) {
  // flipColor: negative diff = green (saved money), positive = red (cost more)
  const dc = diff === undefined || Math.abs(diff) < 1 ? null
    : flipColor
    ? (diff < 0 ? "#4ade80" : "#f87171")
    : (diff > 0 ? "#4ade80" : "#f87171");

  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
      <span style={{ fontSize: big ? 13 : 12, color: "#94a3b8" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        {dc && (
          <span style={{ fontSize: 11, color: dc, background: "#0f172a", borderRadius: 4, padding: "1px 5px" }}>
            {diff > 0 ? "+" : ""}{fmt(diff)}
          </span>
        )}
        <span style={{ fontSize: big ? 15 : 13, fontWeight: big ? 700 : 500, color: color || "#f1f5f9" }}>{val}</span>
      </div>
    </div>
  );
}

function Tile({ label, val, sub, color }) {
  return (
    <div style={{ background: "#0f172a", borderRadius: 10, padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, marginBottom: 4 }}>{val}</div>
      <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.5 }}>{sub}</div>
    </div>
  );
}
