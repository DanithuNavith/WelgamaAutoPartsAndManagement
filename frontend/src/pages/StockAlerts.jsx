import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Eye, List, Package,
  Pause, Play, RotateCw, Search, ShoppingCart, TrendingUp
} from 'lucide-react';
import { getStockFlags, refreshStockFlags } from '../services/api';
import mockFlags from '../data/stockFlagsMock.json';
import './StockAlerts.css';

// Live scoring is the default; set VITE_USE_STOCK_FLAGS_MOCK=true only for demos.
const USE_STOCK_FLAGS_MOCK = import.meta.env.VITE_USE_STOCK_FLAGS_MOCK === 'true';
const AUTO_ADVANCE_MS = 6000;
const TIERS = {
  'CRITICAL - already low': { label: 'CRITICAL', icon: AlertTriangle, className: 'critical', order: 0 },
  'HIGH - reorder now': { label: 'HIGH', icon: TrendingUp, className: 'high', order: 1 },
  'WATCH - likely low within 7 days': { label: 'WATCH', icon: Eye, className: 'watch', order: 2 }
};
const TIER_OPTIONS = [
  ['all', 'All tiers'],
  ['CRITICAL - already low', 'Critical'],
  ['HIGH - reorder now', 'High'],
  ['WATCH - likely low within 7 days', 'Watch']
];
const emptySummary = { critical: 0, high: 0, watch: 0, total: 0 };

const getSummary = flags => flags.reduce((summary, item) => {
  if (item.flag === TIER_OPTIONS[1][0]) summary.critical += 1;
  if (item.flag === TIER_OPTIONS[2][0]) summary.high += 1;
  if (item.flag === TIER_OPTIONS[3][0]) summary.watch += 1;
  summary.total += 1;
  return summary;
}, { ...emptySummary });

const asFlagResult = flags => ({
  flags,
  scoredAt: null,
  source: 'mock',
  summary: getSummary(flags)
});

const StockAlerts = ({ active, onCountChange }) => {
  const navigate = useNavigate();
  const [flags, setFlags] = useState([]);
  const [summary, setSummary] = useState(emptySummary);
  const [scoredAt, setScoredAt] = useState(null);
  const [historyDays, setHistoryDays] = useState(null);
  const [source, setSource] = useState('model');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [view, setView] = useState('spotlight');
  const [currentId, setCurrentId] = useState(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isVisible, setIsVisible] = useState(() => !document.hidden);
  const [reducedMotion, setReducedMotion] = useState(() => (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ));
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sort, setSort] = useState({ key: 'severity', direction: 'asc' });
  const touchStartX = useRef(null);
  const carouselRef = useRef(null);

  const orderedFlags = useMemo(() => [...flags]
    .filter(item => TIERS[item.flag])
    .sort((left, right) => (
      TIERS[left.flag].order - TIERS[right.flag].order
      || Number(right.p_low_7d) - Number(left.p_low_7d)
    )), [flags]);
  const selectedIndex = Math.max(0, orderedFlags.findIndex(item => item.product_id === currentId));
  const selectedFlag = orderedFlags[selectedIndex];
  const categories = useMemo(() => [...new Set(orderedFlags.map(item => item.category).filter(Boolean))].sort(), [orderedFlags]);

  const loadFlags = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = USE_STOCK_FLAGS_MOCK
        ? await Promise.resolve(asFlagResult(mockFlags))
        : await getStockFlags();
      const nextFlags = Array.isArray(result.flags) ? result.flags : [];
      setFlags(nextFlags);
      setSummary(result.summary || getSummary(nextFlags));
      setScoredAt(result.scoredAt || null);
      setHistoryDays(result.historyDays ?? null);
      setSource(result.source || 'model');
      elapsedRef.current = 0;
      setElapsed(0);
      setCurrentId(current => (
        nextFlags.some(item => item.product_id === current)
          ? current
          : nextFlags.find(item => TIERS[item.flag])?.product_id || null
      ));
      onCountChange?.(getSummary(nextFlags).total);
    } catch (loadError) {
      setError(loadError.message || 'Could not load stock alerts.');
      if (!isRefresh) onCountChange?.(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => { void loadFlags(); }, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadFlags]);

  useEffect(() => {
    const onVisibilityChange = () => setIsVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onMotionChange = event => setReducedMotion(event.matches);
    media.addEventListener('change', onMotionChange);
    return () => media.removeEventListener('change', onMotionChange);
  }, []);

  useEffect(() => {
    if (!active || !selectedFlag || reducedMotion || isPaused || isHovering || isFocused || !isVisible) return undefined;
    const interval = window.setInterval(() => {
      elapsedRef.current += 100;
      if (elapsedRef.current >= AUTO_ADVANCE_MS) {
        elapsedRef.current = 0;
        setElapsed(0);
        setCurrentId(orderedFlags[(selectedIndex + 1) % orderedFlags.length].product_id);
      } else setElapsed(elapsedRef.current);
    }, 100);
    return () => window.clearInterval(interval);
  }, [active, isFocused, isHovering, isPaused, isVisible, orderedFlags, reducedMotion, selectedFlag, selectedIndex]);

  const changeSlide = index => {
    if (!orderedFlags.length) return;
    const nextIndex = (index + orderedFlags.length) % orderedFlags.length;
    elapsedRef.current = 0;
    setElapsed(0);
    setCurrentId(orderedFlags[nextIndex].product_id);
  };

  const filteredFlags = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = orderedFlags.filter(item => (
      (tierFilter === 'all' || item.flag === tierFilter)
      && (categoryFilter === 'all' || item.category === categoryFilter)
      && (!normalizedQuery || `${item.name} ${item.category}`.toLowerCase().includes(normalizedQuery))
    ));
    const valueFor = item => {
      if (sort.key === 'severity') return TIERS[item.flag].order;
      if (sort.key === 'name' || sort.key === 'category') return String(item[sort.key] || '').toLowerCase();
      return Number(item[sort.key] || 0);
    };
    return filtered.sort((left, right) => {
      const first = valueFor(left);
      const second = valueFor(right);
      const comparison = typeof first === 'string' ? first.localeCompare(second) : first - second;
      return comparison * (sort.direction === 'asc' ? 1 : -1);
    });
  }, [categoryFilter, orderedFlags, query, sort, tierFilter]);

  const changeSort = key => setSort(current => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
  }));

  const refresh = async () => {
    setError('');
    if (!USE_STOCK_FLAGS_MOCK) {
      setRefreshing(true);
      setError('');
      try {
        await refreshStockFlags();
      } catch (refreshError) {
        setError(refreshError.message || 'Could not refresh stock alerts.');
        await loadFlags(true);
        return;
      }
    }
    await loadFlags(true);
  };

  const openPurchaseOrder = item => {
    navigate('/admin/purchase-orders', {
      state: {
        reorder: {
          productId: item.product_id,
          productName: item.name,
          category: item.category,
          quantity: Math.max(1, Number(item.suggested_order_qty) || 1)
        }
      }
    });
  };

  const selectTableItem = item => {
    changeSlide(orderedFlags.findIndex(flag => flag.product_id === item.product_id));
    setView('spotlight');
  };

  const onCarouselKeyDown = event => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      changeSlide(selectedIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      changeSlide(selectedIndex + 1);
    }
  };

  const onViewTabKeyDown = event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const nextView = event.key === 'ArrowRight'
      ? (view === 'spotlight' ? 'list' : 'spotlight')
      : (view === 'list' ? 'spotlight' : 'list');
    setView(nextView);
    document.getElementById(`stock-view-${nextView}-tab`)?.focus();
  };

  const onTouchStart = event => {
    touchStartX.current = event.changedTouches[0].clientX;
  };
  const onTouchEnd = event => {
    if (touchStartX.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(distance) > 45) changeSlide(selectedIndex + (distance < 0 ? 1 : -1));
    touchStartX.current = null;
  };

  const formatScoredAt = () => {
    if (USE_STOCK_FLAGS_MOCK) return 'Example CSV · 30 Sep 2026';
    if (source === 'recent-demand-forecast') return 'Recent 28-day demand · 7-day forecast';
    if (source === 'inventory-threshold') return 'Live inventory · threshold check';
    if (!scoredAt) return 'Not scored yet';
    const date = new Date(scoredAt);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
  };

  const countItems = summary.total ?? orderedFlags.length;

  return (
    <div className="stock-alerts">
      <div className="stock-alerts-heading">
        <div>
          <span className="stock-alerts-eyebrow"><AlertTriangle size={15} /> EARLY WARNING</span>
          <h3>Stock alerts</h3>
          <p>{source === 'recent-demand-forecast' ? '7-day demand forecast based on recorded part usage over the last 28 days.' : source === 'inventory-threshold' ? 'Current inventory at or below its low-stock threshold; no recent demand history is available to forecast.' : `Trained-model stock risk for the next 7 days.${historyDays != null && historyDays < 56 ? ` Using ${historyDays} days of history; forecast confidence may improve as more history is recorded.` : ''}`}</p>
        </div>
        <div className="stock-source-wrap">
          {USE_STOCK_FLAGS_MOCK && <span className="stock-mock-label">EXAMPLE CSV · MOCK DATA</span>}
          <span className="stock-scored-at">{source === 'inventory-threshold' ? 'Alert source' : 'Last scored'} <strong>{formatScoredAt()}</strong></span>
        </div>
      </div>

      <div className="stock-alert-summary" aria-label="Stock alert counts">
        {[
          ['critical', 'Critical'],
          ['high', 'High'],
          ['watch', 'Watch']
        ].map(([key, label]) => (
          <div className={`stock-summary-item ${key}`} key={key}>
            <span>{label}</span><strong>{summary[key] || 0}</strong>
          </div>
        ))}
        <button type="button" className="stock-refresh-button" onClick={refresh} disabled={refreshing}>
          <RotateCw size={16} className={refreshing ? 'is-spinning' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="stock-alert-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => { setLoading(true); setError(''); loadFlags(); }}>Try again</button>
        </div>
      )}

      <div className="stock-view-tabs" role="tablist" aria-label="Stock alerts views">
        <button id="stock-view-spotlight-tab" type="button" role="tab" aria-selected={view === 'spotlight'} aria-controls="stock-views-panel" tabIndex={view === 'spotlight' ? 0 : -1} className={view === 'spotlight' ? 'active' : ''} onClick={() => setView('spotlight')} onKeyDown={onViewTabKeyDown}>
          <Eye size={16} /> Spotlight
        </button>
        <button id="stock-view-list-tab" type="button" role="tab" aria-selected={view === 'list'} aria-controls="stock-views-panel" tabIndex={view === 'list' ? 0 : -1} className={view === 'list' ? 'active' : ''} onClick={() => setView('list')} onKeyDown={onViewTabKeyDown}>
          <List size={16} /> List <span className="stock-view-count">{countItems}</span>
        </button>
      </div>

      <div id="stock-views-panel" role="tabpanel" aria-labelledby={`stock-view-${view}-tab`} tabIndex={0}>
      {loading ? (
        <div className="stock-alert-loading" role="status"><span className="stock-loading-mark" /> Loading stock alerts…</div>
      ) : error && !orderedFlags.length ? (
        <div className="stock-alert-empty" role="status">
          <span><AlertTriangle size={25} /></span>
          <h4>Stock alerts are unavailable</h4>
          <p>Check the server connection and try loading the alerts again.</p>
        </div>
      ) : !orderedFlags.length ? (
        <div className="stock-alert-empty" role="status">
          <span><Package size={25} /></span>
          <h4>No parts at risk in the next 7 days</h4>
          <p>Inventory is looking healthy. Refresh after your next sales or receiving update.</p>
        </div>
      ) : view === 'spotlight' ? (
        <div className="stock-spotlight">
          <div className="stock-spotlight-toolbar">
            <span><strong>{selectedIndex + 1}</strong> / {orderedFlags.length} flagged parts</span>
            {reducedMotion && <span className="stock-motion-note">Auto-advance off for reduced motion</span>}
          </div>
          <div
            className={`stock-carousel ${reducedMotion ? 'reduced-motion' : ''}`}
            role="region"
            aria-label="Flagged stock parts"
            aria-roledescription="carousel"
            tabIndex={0}
            ref={carouselRef}
            onKeyDown={onCarouselKeyDown}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            onFocus={() => setIsFocused(true)}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsFocused(false);
            }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className="stock-progress-track" aria-hidden="true">
              <span style={{ width: `${reducedMotion ? 0 : (elapsed / AUTO_ADVANCE_MS) * 100}%` }} />
            </div>
            {selectedFlag && (() => {
              const tier = TIERS[selectedFlag.flag];
              const SeverityIcon = tier.icon;
              const gaugeMax = Math.max(Number(selectedFlag.stock), Number(selectedFlag.threshold) * 1.5, 1);
              const stockWidth = Math.min(100, (Number(selectedFlag.stock) / gaugeMax) * 100);
              const thresholdPosition = Math.min(100, (Number(selectedFlag.threshold) / gaugeMax) * 100);
              return (
                <article className={`stock-spotlight-card ${tier.className}`} key={selectedFlag.product_id} role="group" aria-roledescription="slide" aria-label={`${selectedIndex + 1} of ${orderedFlags.length}`}>
                  <div className="stock-card-main">
                    <div className="stock-card-copy">
                      <div className="stock-card-label-row">
                        <span className={`stock-severity ${tier.className}`}><SeverityIcon size={15} /> {tier.label} · {selectedFlag.flag.replace(/^[^-]+-\s*/, '')}</span>
                        <span className="stock-category">{selectedFlag.category}</span>
                      </div>
                      <h4>{selectedFlag.name}</h4>
                      <p className="stock-card-caption">{source === 'recent-demand-forecast' ? 'Based on recent recorded demand · next 7 days' : source === 'inventory-threshold' ? 'Current stock is at or below its reorder threshold' : 'Stock health · predicted over the next 7 days'}</p>
                      <div className="stock-gauge" role="img" aria-label={`Current stock ${selectedFlag.stock} units; threshold ${selectedFlag.threshold} units`}>
                        <div className="stock-gauge-track">
                          <span className="stock-gauge-fill" style={{ width: `${stockWidth}%` }} />
                          <span className="stock-gauge-threshold" style={{ left: `${thresholdPosition}%` }} />
                        </div>
                        <div className="stock-gauge-labels">
                          <span><strong>{selectedFlag.stock}</strong> current stock</span>
                          <span>Threshold <strong>{selectedFlag.threshold}</strong></span>
                        </div>
                      </div>
                    </div>
                    <div className="stock-probability">
                      <span>Risk in 7 days</span>
                      <strong>{selectedFlag.p_low_7d == null ? '—' : <>{Math.round(Number(selectedFlag.p_low_7d) * 100)}<small>%</small></>}</strong>
                      <span className="stock-probability-caption">{selectedFlag.p_low_7d == null ? 'model unavailable' : 'probability'}</span>
                    </div>
                  </div>
                  <div className="stock-card-metrics">
                    <div><span>{source === 'inventory-threshold' ? 'Threshold status' : 'Estimated time to threshold'}</span><strong>{source === 'inventory-threshold' ? 'At or below threshold' : selectedFlag.days_to_threshold == null ? 'Beyond forecast' : Number(selectedFlag.days_to_threshold) === 0 ? 'Already at threshold' : `${Number(selectedFlag.days_to_threshold).toFixed(1)} days`}</strong></div>
                    <div><span>Predicted daily demand</span><strong>{selectedFlag.pred_daily_demand == null ? '—' : <>{Number(selectedFlag.pred_daily_demand).toFixed(2)} <small>units / day</small></>}</strong></div>
                    <div><span>Expected demand · next 7 days</span><strong>{selectedFlag.forecast_demand_7d == null ? 'Not scored' : <>{Number(selectedFlag.forecast_demand_7d).toFixed(1)} <small>units</small></>}</strong></div>
                    <div><span>Suggested order quantity</span><strong>{selectedFlag.suggested_order_qty == null ? 'Not scored' : <>{selectedFlag.suggested_order_qty} <small>units</small></>}</strong></div>
                  </div>
                  <div className="stock-card-footer">
                    <span><Package size={16} /> {source === 'inventory-threshold' ? 'Based on current stock and reorder threshold' : 'Based on current stock and model forecast'}</span>
                    <button type="button" className="stock-order-button" onClick={() => openPurchaseOrder(selectedFlag)}>
                      <ShoppingCart size={16} /> Create purchase order
                    </button>
                  </div>
                </article>
              );
            })()}
            <div className="stock-carousel-controls">
              <button type="button" aria-label="Previous flagged part" onClick={() => changeSlide(selectedIndex - 1)}><ArrowLeft size={17} /><span>Previous</span></button>
              <div className="stock-carousel-dots" role="group" aria-label="Choose a flagged part">
                {orderedFlags.map((item, index) => (
                  <button
                    type="button"
                    key={item.product_id}
                    className={index === selectedIndex ? 'active' : ''}
                    aria-label={`Show ${item.name}`}
                    aria-current={index === selectedIndex ? 'true' : undefined}
                    onClick={() => changeSlide(index)}
                  />
                ))}
              </div>
              <button type="button" className="stock-play-button" onClick={() => setIsPaused(value => !value)} aria-label={isPaused ? 'Play automatic spotlight' : 'Pause automatic spotlight'} aria-pressed={isPaused} disabled={reducedMotion}>
                {isPaused ? <Play size={16} /> : <Pause size={16} />}
              </button>
              <button type="button" aria-label="Next flagged part" onClick={() => changeSlide(selectedIndex + 1)}><span>Next</span><ArrowRight size={17} /></button>
            </div>
            <p className="stock-keyboard-hint">Use ← → to browse · swipe on mobile</p>
            <span className="stock-screen-reader-only" aria-live="polite" aria-atomic="true">
              {selectedFlag && `Showing ${selectedIndex + 1} of ${orderedFlags.length}: ${selectedFlag.name}, ${TIERS[selectedFlag.flag].label}`}
            </span>
          </div>
        </div>
      ) : (
        <div className="stock-list">
          <div className="stock-list-filters">
            <label className="stock-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by part or category" aria-label="Search flagged parts" /></label>
            <label>Tier<select value={tierFilter} onChange={event => setTierFilter(event.target.value)}>{TIER_OPTIONS.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            <label>Category<select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map(category => <option key={category}>{category}</option>)}</select></label>
          </div>
          <div className="stock-table-wrap">
            <table className="stock-table">
              <thead><tr>
                {[
                  ['severity', 'Severity'],
                  ['name', 'Part'],
                  ['category', 'Category'],
                  ['stock', 'Stock / threshold'],
                  ['p_low_7d', '7-day risk'],
                  ['days_to_threshold', 'Days to threshold'],
                  ['suggested_order_qty', 'Order qty']
                ].map(([key, label]) => (
                  <th key={key} aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => changeSort(key)}>{label}</button>
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {filteredFlags.length ? filteredFlags.map(item => {
                  const tier = TIERS[item.flag];
                  const SeverityIcon = tier.icon;
                  return (
                    <tr key={item.product_id} tabIndex={0} aria-label={`Open spotlight for ${item.name}`} onClick={() => selectTableItem(item)} onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        selectTableItem(item);
                      }
                    }}>
                      <td><span className={`stock-severity table-severity ${tier.className}`}><SeverityIcon size={14} /> {tier.label}</span></td>
                      <td><strong>{item.name}</strong></td>
                      <td>{item.category}</td>
                      <td>{item.stock} <span className="stock-table-muted">/ {item.threshold}</span></td>
                      <td>{item.p_low_7d == null ? '—' : `${Math.round(Number(item.p_low_7d) * 100)}%`}</td>
                      <td>{item.days_to_threshold == null ? '—' : `${Number(item.days_to_threshold).toFixed(1)} days`}</td>
                      <td>{item.suggested_order_qty ?? '—'}</td>
                    </tr>
                  );
                }) : <tr><td colSpan="7" className="stock-table-empty">No flagged parts match these filters.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="stock-list-note">Select a row to open that part in Spotlight.</p>
        </div>
      )}
      </div>
    </div>
  );
};

export default StockAlerts;
