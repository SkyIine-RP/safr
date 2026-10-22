/* SAFR handbook: loads the files in /data and draws each tab. */
(() => {
    'use strict';

    const $ = (s, r = document) => r.querySelector(s);
    const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const searchIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

    /* ---------- CSV (handles quotes, commas and line breaks in cells) ---------- */
    function parseCSV(text) {
        const rows = [];
        let row = [], cell = '', q = false;
        text = String(text).replace(/^﻿/, '');
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (q) {
                if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
                else if (c === '"') q = false;
                else cell += c;
            } else if (c === '"') q = true;
            else if (c === ',') { row.push(cell); cell = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && text[i + 1] === '\n') i++;
                row.push(cell); rows.push(row); row = []; cell = '';
            } else cell += c;
        }
        if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
        const clean = rows.filter((r) => r.some((x) => x.trim() !== ''));
        if (!clean.length) return [];
        const head = clean[0].map((h) => h.trim());
        return clean.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
    }

    const cache = {};
    async function load(file) {
        if (cache[file]) return cache[file];
        const res = await fetch(`data/${file}?v=${Date.now() - (Date.now() % 60000)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Couldn't load ${file} (${res.status}).`);
        const text = await res.text();
        cache[file] = file.endsWith('.csv') ? parseCSV(text) : text;
        return cache[file];
    }

    function fail(view, e) {
        view.innerHTML = `<p class="error">${esc(e.message || e)}</p>`;
    }

    /* ---------- ranks ---------- */
    let ranks = null; // [{ grade, rank }] highest first
    async function getRanks() {
        if (ranks) return ranks;
        try {
            ranks = (await load('ranks.csv')).map((r) => ({ grade: Number(r.Grade), rank: r.Rank })).sort((a, b) => b.grade - a.grade);
        } catch (e) { ranks = []; }
        return ranks;
    }
    const rankOrder = (name) => {
        const i = (ranks || []).findIndex((r) => r.rank.toLowerCase() === String(name).toLowerCase());
        return i < 0 ? 999 : i;
    };

    /* ---------- SOPs ---------- */
    async function renderSops(view) {
        const md = await load('sops.md');
        const html = window.marked ? marked.parse(md, { gfm: true }) : `<pre>${esc(md)}</pre>`;
        const safe = window.DOMPurify ? DOMPurify.sanitize(html) : html;
        view.innerHTML = `<div class="sop"><nav class="toc" aria-label="On this page"><p>On this page</p></nav><article class="doc">${safe}</article></div>`;
        const doc = $('.doc', view), toc = $('.toc', view);

        // tables scroll on small screens; rows starting with a star are the common codes
        doc.querySelectorAll('table').forEach((t) => {
            const box = document.createElement('div');
            box.className = 'table-scroll';
            t.replaceWith(box);
            box.appendChild(t);
            t.querySelectorAll('tbody tr').forEach((tr) => {
                const first = tr.cells[0];
                if (first && /^\s*★/.test(first.textContent)) {
                    tr.classList.add('common');
                    first.innerHTML = first.innerHTML.replace(/★\s*/, '') + '<span class="tag common">Common</span>';
                }
            });
        });

        // table of contents from the main headings
        const heads = [...doc.querySelectorAll('h2')];
        heads.forEach((h) => { h.id = slug(h.textContent); });
        toc.insertAdjacentHTML('beforeend', heads.map((h) => `<a href="#sops/${h.id}" data-to="${h.id}">${esc(h.textContent)}</a>`).join(''));
        toc.addEventListener('click', (e) => {
            const a = e.target.closest('a[data-to]');
            if (!a) return;
            e.preventDefault();
            const el = document.getElementById(a.dataset.to);
            if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
            history.replaceState(null, '', `#sops/${a.dataset.to}`);
        });
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach((en) => {
                    if (!en.isIntersecting) return;
                    toc.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.to === en.target.id));
                });
            }, { rootMargin: '-80px 0px -70% 0px' });
            heads.forEach((h) => io.observe(h));
        }
        const want = location.hash.split('/')[1];
        if (want) { const el = document.getElementById(want); if (el) setTimeout(() => el.scrollIntoView(), 50); }
    }

    /* ---------- roster ---------- */
    const rosterState = { q: '', status: 'All' };
    async function renderRoster(view) {
        await getRanks();
        const people = await load('roster.csv');
        const statusClass = (s) => ({ active: 'active', loa: 'loa' }[String(s).toLowerCase()] || '');
        const count = (s) => people.filter((p) => String(p.Status).toLowerCase() === s).length;

        view.innerHTML = `<div class="page-head"><div><h1>Roster</h1><p>Everyone in SAFR, grouped by rank. Command keeps this up to date.</p></div>
            <div class="tools"><label class="search">${searchIcon}<input id="roster-q" type="search" placeholder="Name or callsign" value="${esc(rosterState.q)}" aria-label="Search the roster" /></label>
            <div class="chips" role="group" aria-label="Filter by status">${['All', 'Active', 'LOA', 'Inactive'].map((s) => `<button type="button" data-status="${s}" aria-pressed="${rosterState.status === s}">${s}</button>`).join('')}</div></div></div>
            <div class="stats"><div class="stat"><b>${people.length}</b><span>Members</span></div><div class="stat active"><b>${count('active')}</b><span>Active</span></div><div class="stat loa"><b>${count('loa')}</b><span>On leave</span></div></div>
            <div id="roster-body"></div>`;

        const draw = () => {
            const q = rosterState.q.toLowerCase();
            const list = people.filter((p) => (rosterState.status === 'All' || String(p.Status).toLowerCase() === rosterState.status.toLowerCase())
                && (!q || `${p.Name} ${p.Callsign} ${p.Rank} ${p.Certs}`.toLowerCase().includes(q)));
            const groups = new Map();
            // with no search or filter, show every rank so open spots are visible
            const filtering = !!q || rosterState.status !== 'All';
            if (!filtering) ranks.forEach((r) => groups.set(r.rank, []));
            list.sort((a, b) => rankOrder(a.Rank) - rankOrder(b.Rank) || String(a.Callsign).localeCompare(String(b.Callsign), undefined, { numeric: true }))
                .forEach((p) => { const k = p.Rank || 'No rank'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
            const body = $('#roster-body', view);
            if (!groups.size) { body.innerHTML = '<p class="empty">Nobody matches that search.</p>'; return; }
            body.innerHTML = [...groups].map(([rank, ps]) => `<h2 class="group-title"><span class="rank-head"><span class="rank-bar ${rankOrder(rank) < 2 ? 'top' : ''}"></span>${esc(rank)}</span><small>${ps.length}</small></h2>
                ${!ps.length ? '<p class="vacant">No one at this rank yet.</p>' : `<table class="roster"><thead><tr><th>Name</th><th>Callsign</th><th>Status</th><th>Certifications</th><th>Joined</th></tr></thead><tbody>
                ${ps.map((p) => `<tr><td class="c-name name">${esc(p.Name)}</td><td class="c-call"><span class="callsign">${esc(p.Callsign) || '<span class="dim">None</span>'}</span></td>
                    <td class="c-status"><span class="status ${statusClass(p.Status)}">${esc(p.Status || 'Unknown')}</span></td>
                    <td class="c-certs"><div class="certs">${String(p.Certs || '').split(',').map((c) => c.trim()).filter(Boolean).map((c) => `<span class="cert">${esc(c)}</span>`).join('') || '<span class="dim">None</span>'}</div></td>
                    <td class="c-join dim">${esc(p['Join Date'])}</td></tr>`).join('')}
                </tbody></table>`}`).join('');
        };
        draw();
        $('#roster-q', view).addEventListener('input', (e) => { rosterState.q = e.target.value; draw(); });
        view.querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => {
            rosterState.status = b.dataset.status;
            view.querySelectorAll('[data-status]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            draw();
        }));
    }

    /* ---------- vehicles ---------- */
    async function renderVehicles(view) {
        await getRanks();
        const cars = await load('vehicles.csv');
        const groups = new Map();
        cars.forEach((c) => { const k = c.Type || 'Other'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
        view.innerHTML = `<div class="page-head"><div><h1>Vehicles</h1><p>What each rank can drive. Pull them from the Pillbox garage or helipad. Click a spawn code to copy it.</p></div></div>
            ${[...groups].map(([type, list]) => `<h2 class="group-title">${esc(type)}<small>${list.length}</small></h2>
            <div class="cards">${list.map((c) => `<article class="card">
                <div class="card-top"><div><h3>${esc(c.Name)}</h3></div><span class="rank-pill" title="Lowest rank that can drive it">${esc(c['Min Rank'] || 'Any')}+</span></div>
                <dl class="facts">
                    <dt>Spawn code</dt><dd><button type="button" class="code-btn" data-copy="${esc(c['Spawn Code'])}" title="Copy">${esc(c['Spawn Code'])}</button></dd>
                    <dt>Livery</dt><dd>${esc(c.Livery || 'Default')}${c['Livery #'] ? ` <span class="dim">(/liv ${esc(c['Livery #'])})</span>` : ''}</dd>
                </dl>
                ${c.Notes ? `<p class="note">${esc(c.Notes)}</p>` : ''}
            </article>`).join('')}</div>`).join('')}`;
        view.addEventListener('click', async (e) => {
            const b = e.target.closest('[data-copy]');
            if (!b) return;
            try { await navigator.clipboard.writeText(b.dataset.copy); } catch (err) { return; }
            b.classList.add('copied');
            const was = b.textContent;
            b.textContent = 'Copied';
            setTimeout(() => { b.classList.remove('copied'); b.textContent = was; }, 1200);
        });
    }

    /* ---------- uniforms ---------- */
    const PIECES = ['Hat', 'Mask', 'Jacket', 'Undershirt', 'Arms', 'Pants', 'Shoes', 'Vest', 'Decals', 'Necklace'];
    const clothState = { gender: 'All' };
    async function renderClothing(view) {
        await getRanks();
        const outfits = await load('clothing.csv');
        view.innerHTML = `<div class="page-head"><div><h1>Uniforms</h1><p>What to wear on duty for your rank. Change into it at the Uniforms point in Pillbox.</p></div>
            <div class="tools"><div class="chips" role="group" aria-label="Filter by gender">${['All', 'Male', 'Female'].map((g) => `<button type="button" data-gender="${g}" aria-pressed="${clothState.gender === g}">${g}</button>`).join('')}</div></div></div>
            <p class="legend">Each piece is <b>style / color</b>, the same two numbers you see in the clothing menu. "Not set" means it's still being decided.</p>
            <div id="cloth-body"></div>`;
        const draw = () => {
            const list = outfits.filter((o) => clothState.gender === 'All' || String(o.Gender).toLowerCase() === clothState.gender.toLowerCase())
                .sort((a, b) => rankOrder(a.Rank) - rankOrder(b.Rank));
            const groups = new Map();
            list.forEach((o) => { const k = o.Rank || 'Any rank'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
            $('#cloth-body', view).innerHTML = list.length ? [...groups].map(([rank, os]) => `<h2 class="group-title">${esc(rank)}<small>${os.length}</small></h2>
                <div class="cards">${os.map((o) => `<article class="card"><div><h3>${esc(o.Outfit || 'Uniform')}</h3><div class="sub">${esc(o.Gender || 'Any')}</div></div>
                    <div class="pieces">${PIECES.map((p) => { const v = o[p]; return `<div class="piece ${v ? '' : 'unset'}"><span>${p}</span><b>${v ? esc(v) : 'Not set'}</b></div>`; }).join('')}</div>
                    ${o.Notes ? `<p class="note">${esc(o.Notes)}</p>` : ''}</article>`).join('')}</div>`).join('') : '<p class="empty">No uniforms yet.</p>';
        };
        draw();
        view.querySelectorAll('[data-gender]').forEach((b) => b.addEventListener('click', () => {
            clothState.gender = b.dataset.gender;
            view.querySelectorAll('[data-gender]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
            draw();
        }));
    }

    /* ---------- tabs ---------- */
    const VIEWS = { sops: renderSops, roster: renderRoster, vehicles: renderVehicles, clothing: renderClothing };
    const drawn = {};
    async function show() {
        const tab = (location.hash.replace('#', '').split('/')[0]) || 'sops';
        const name = VIEWS[tab] ? tab : 'sops';
        document.querySelectorAll('[data-tab]').forEach((a) => a.setAttribute('aria-selected', String(a.dataset.tab === name)));
        Object.keys(VIEWS).forEach((k) => { $(`#view-${k}`).hidden = k !== name; });
        const view = $(`#view-${name}`);
        document.title = `${{ sops: 'SOPs', roster: 'Roster', vehicles: 'Vehicles', clothing: 'Uniforms' }[name]} | SAFR Handbook`;
        if (!drawn[name]) {
            drawn[name] = true;
            view.innerHTML = '<p class="loading">Loading...</p>';
            try { await VIEWS[name](view); } catch (e) { drawn[name] = false; fail(view, e); }
        }
    }
    window.addEventListener('hashchange', () => {
        const tab = location.hash.replace('#', '').split('/')[0];
        if (!location.hash.includes('/')) window.scrollTo(0, 0);
        show(tab);
    });
    show();
})();
