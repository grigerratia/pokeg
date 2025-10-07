import React, { useState, useEffect, useCallback, useMemo } from 'react';

// --- 1. CONSTANTES Y UTILIDADES (De components/Constants.js) ---
const URL_BASE = 'https://pokeapi.co/api/v2';
const POKE_LIMIT = 20;
const MAX_POKEMONS = 1000;
const T_DARK = 'oscuro';
const R_MAIN = 'principal';
const R_FAVS = 'favoritos';
const MAX_RETRIES = 3;

const capitalizar = (s) => (s && s.length > 0) ? s.charAt(0).toUpperCase() + s.slice(1) : '';

// Mapeo de colores (para estilos dinámicos)
const COLORS = {
  normal: '#a8a878', fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030',
  ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0', ground: '#e0c068', flying: '#a890f0',
  psychic: '#f85888', bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8',
  steel: '#b8b8d0', fairy: '#ee99ac', dark: '#705848', shadow: '#404040', unknown: '#68a090',
};

// --- 2. COMPONENTES DE ÍCONOS (De components/Icons.jsx) ---

// Icono Corazón
const IconoCorazon = ({ solido = false, color = "currentColor" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={solido ? color : "none"} stroke={solido ? "none" : color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="corazon-icono"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
);

// Icono Filtro
const IconoFiltro = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M22 3H2l8 11.5v5l4 2v-7.5L22 3z" /></svg>
);

// Icono Cerrar
const IconoCerrar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
);


// --- 3. CUSTOM HOOK (De components/usePokedex.js) ---
const usePokedex = () => {
  const [rawList, setRawList] = useState([]);
  const [viewList, setViewList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [initLoading, setInitLoading] = useState(true);
  const [error, setError] = useState(null);
  const [favs, setFavs] = useState([]);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [types, setTypes] = useState([]);
  const [filters, setFilters] = useState({ tipo: null, pesoMin: null, pesoMax: null, alturaMin: null, alturaMax: null });

  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem('pokedex_favoritos')) || []); }
    catch (e) { setFavs([]); }
  }, []);

  const toggleFav = useCallback((p) => {
    setFavs(prev => {
      const isFav = prev.some(f => f.id === p.id);
      let newFavs;
      if (isFav) {
        newFavs = prev.filter(f => f.id !== p.id);
        setFeedback({ txt: `${capitalizar(p.nombre)} eliminado.`, type: 'error' });
      } else {
        // Asegurar que la estructura del favorito guardado es mínima
        newFavs = [...prev, { id: p.id, nombre: p.nombre, gif: p.gif, tipos: p.tipos, urlDetalle: `${URL_BASE}/pokemon/${p.id}` }];
        setFeedback({ txt: `${capitalizar(p.nombre)} agregado!`, type: 'success' });
      }
      localStorage.setItem('pokedex_favoritos', JSON.stringify(newFavs));
      return newFavs;
    });
  }, []);

  const fetchRetry = useCallback(async (url, attempts = 0) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempts < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (2 ** attempts)));
        return fetchRetry(url, attempts + 1);
      }
      throw new Error(`Failed to fetch ${url}.`);
    }
  }, []);

  const fetchDetails = useCallback(async (raw) => {
    if (!raw || raw.length === 0) return [];
    const promises = raw.map(p => fetchRetry(p.url || `${URL_BASE}/pokemon/${p.id}`));
    const data = await Promise.all(promises);
    return data.map(d => ({
      id: d.id,
      nombre: d.name,
      tipos: d.types.map(t => t.type.name),
      peso: d.weight / 10,
      altura: d.height / 10,
      gif: d.sprites.versions['generation-v']['black-white'].animated.front_default || d.sprites.front_default,
      urlDetalle: `${URL_BASE}/pokemon/${d.id}`,
      stats: d.stats.map(s => ({ name: s.stat.name, base_stat: s.base_stat })),
    }));
  }, [fetchRetry]);

  const loadInitialData = useCallback(async () => {
    setInitLoading(true);
    try {
      const listData = await fetchRetry(`${URL_BASE}/pokemon?limit=${MAX_POKEMONS}`);
      const listWithId = listData.results.map((p, i) => ({ ...p, id: i + 1 }));
      setRawList(listWithId);
      const typeData = await fetchRetry(`${URL_BASE}/type`);
      setTypes(typeData.results.map(t => t.name).filter(n => n !== 'unknown' && n !== 'shadow'));
    } catch (err) {
      setError("Failed to load base Pokédex data.");
    } finally {
      setInitLoading(false);
    }
  }, [fetchRetry]);

  useEffect(() => { loadInitialData(); }, [loadInitialData]);
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => setFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const filteredRaw = useMemo(() => {
    let list = rawList;
    if (query) {
      const q = query.toLowerCase();
      // Buscar en toda la lista raw, pero solo mostrar los que cargaremos en la vista
      list = list.filter(p => p.name.includes(q) || String(p.id).startsWith(q));
    }
    return list;
  }, [rawList, query]);

  const totalPages = Math.ceil(filteredRaw.length / POKE_LIMIT);
  const offset = (page - 1) * POKE_LIMIT;

  const loadPage = useCallback(async () => {
    if (filteredRaw.length === 0 && !query && Object.values(filters).every(f => f === null)) {
      setViewList([]); setLoading(false); return;
    }
    setLoading(true);
    setError(null);

    const pageRaw = filteredRaw.slice(offset, offset + POKE_LIMIT);

    try {
      const details = await fetchDetails(pageRaw);
      const { tipo, pesoMin, pesoMax, alturaMin, alturaMax } = filters;

      // Aplicar filtros basados en detalles
      const filteredDetails = details.filter(p => {
        if (tipo && !p.tipos.includes(tipo)) return false;
        if (pesoMin !== null && p.peso < pesoMin) return false;
        if (pesoMax !== null && p.peso > pesoMax) return false;
        if (alturaMin !== null && p.altura < alturaMin) return false;
        if (alturaMax !== null && p.altura > alturaMax) return false;
        return true;
      });

      setViewList(filteredDetails);
    } catch (err) {
      setError("Failed to load page details.");
      setViewList([]);
    } finally {
      setLoading(false);
    }
  }, [filteredRaw, offset, fetchDetails, filters, query]);

  useEffect(() => {
    if (!initLoading) loadPage();
  }, [loadPage, initLoading, page, filteredRaw.length, filters]);

  const changePage = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  const fetchDetailById = useCallback(async (id) => {
    try { return (await fetchDetails([{ id }]))[0] || null; }
    catch (e) { return null; }
  }, [fetchDetails]);

  return {
    viewList, favs, types, loading: loading || initLoading, error, query, setQuery, filters, setFilters,
    page, totalPages, totalFound: filteredRaw.length, changePage, toggleFav, feedback, fetchDetailById
  };
};


// --- 4. COMPONENTE FICHA POKEMON (De components/FichaPokemon.jsx) ---
const FichaPokemon = React.memo(({ pokemon, isFav, onSelect, onFavClick }) => {
  const mainType = pokemon.tipos[0] || 'normal';
  const bgColor = COLORS[mainType];
  const cardStyle = {
    backgroundColor: `${bgColor}20`,
    borderColor: bgColor,
  };

  const handleError = (e) => {
    e.target.onerror = null;
    e.target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
  };

  return (
    <div className="pokemon-card" style={cardStyle} onClick={() => onSelect(pokemon.id)}>
      <div className="card-img-container">
        <img src={pokemon.gif} alt={pokemon.nombre} className="card-img" loading="lazy" onError={handleError} />
      </div>
      <div className="card-content-wrap">
        <div className="card-header">
          <div className="card-info-text">
            <span className="card-id">Nº {String(pokemon.id).padStart(3, '0')}</span>
            <h3 className="card-name">{capitalizar(pokemon.nombre)}</h3>
          </div>
          {/* Botón de favoritos visible */}
          <button className="fav-button" onClick={(e) => { e.stopPropagation(); onFavClick(pokemon); }} aria-label={isFav ? "Eliminar de favoritos" : "Agregar a favoritos"}>
            <IconoCorazon solido={isFav} color="#ef4444" />
          </button>
        </div>
        <div className="type-list-compact">
          <span className="type-badge-small" style={{ backgroundColor: bgColor }}>{capitalizar(mainType)}</span>
        </div>
      </div>
    </div>
  );
});


// --- 5. COMPONENTE PAGINACION (De components/Paginacion.jsx) ---
const Paginacion = ({ page, totalPages, changePage }) => {
  if (totalPages <= 1) return null;
  const maxVisible = 7;
  let start = 1, end = totalPages;
  const half = Math.floor(maxVisible / 2);

  if (totalPages > maxVisible) {
    start = page - half;
    end = page + half;
    if (start < 1) { start = 1; end = maxVisible; }
    if (end > totalPages) { end = totalPages; start = totalPages - maxVisible + 1; }
  }
  const pages = [];
  for (let i = start; i <= end; i++) pages.push(i);

  return (
    <div className="pagination-container">
      <button onClick={() => changePage(page - 1)} disabled={page === 1} className="page-button nav">&laquo;</button>
      {pages.map(num => (
        <button key={num} onClick={() => changePage(num)} className={`page-button ${num === page ? 'active' : ''}`}>{num}</button>
      ))}
      <button onClick={() => changePage(page + 1)} disabled={page === totalPages} className="page-button nav">&raquo;</button>
    </div>
  );
};


// --- 6. MODAL BUSQUEDA AVANZADA (De components/ModalBusquedaAvanzada.jsx) ---
const ModalBusquedaAvanzada = ({ estaAbierto, alCerrar, tiposDisponibles, filtrosActuales, alAplicarFiltros }) => {
  const [intFilters, setIntFilters] = useState(filtrosActuales);
  useEffect(() => { setIntFilters(filtrosActuales); }, [filtrosActuales]);

  const onChange = (field, value) => {
    let val = value;
    if (field.includes('peso') || field.includes('altura')) {
      val = val === '' ? null : Number(val);
      if (isNaN(val)) val = null;
    }
    if (field === 'tipo' && val === '') val = null;
    setIntFilters(prev => ({ ...prev, [field]: val }));
  };

  const applyFilter = () => { alAplicarFiltros(intFilters); alCerrar(); };
  const getVal = (field) => intFilters[field] === null ? '' : intFilters[field];

  if (!estaAbierto) return null;

  return (
    <div className="modal-overlay" onClick={alCerrar}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Búsqueda Avanzada</h2>
          <button onClick={alCerrar} className="modal-close-button"><IconoCerrar /></button>
        </div>
        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <p>Filtra por tipo, peso (kg) y altura (m).</p>
          <div>
            <label htmlFor="tipo" className="form-label">Tipo:</label>
            <select id="tipo" value={getVal('tipo')} onChange={e => onChange('tipo', e.target.value)} className="form-select">
              <option value="">-- Sin Filtro --</option>
              {tiposDisponibles.map(t => (<option key={t} value={t}>{capitalizar(t)}</option>))}
            </select>
          </div>

          <div>
            <label className="form-label">Peso (kg)</label>
            <div className="form-input-group">
              <input type="number" placeholder="Mínimo (ej: 5.0)" value={getVal('pesoMin')} onChange={e => onChange('pesoMin', e.target.value)} className="form-input" min="0" />
              <input type="number" placeholder="Máximo (ej: 100.0)" value={getVal('pesoMax')} onChange={e => onChange('pesoMax', e.target.value)} className="form-input" min="0" />
            </div>
          </div>

          <div>
            <label className="form-label">Altura (m)</label>
            <div className="form-input-group">
              <input type="number" placeholder="Mínimo (ej: 0.3)" value={getVal('alturaMin')} onChange={e => onChange('alturaMin', e.target.value)} className="form-input" min="0" />
              <input type="number" placeholder="Máximo (ej: 1.5)" value={getVal('alturaMax')} onChange={e => onChange('alturaMax', e.target.value)} className="form-input" min="0" />
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={applyFilter} className="action-button">Aplicar Filtro</button>
        </div>
      </div>
    </div>
  );
};


// --- 7. MODAL DETALLE POKEMON (De components/ModalDetallePokemon.jsx) ---
const ModalDetallePokemon = ({ pokemon, alCerrarModal, alSeleccionarEvolucion, fetchDetailById, isFav, toggleFav }) => {
  const [fullDetail, setFullDetail] = useState(null);
  const [evoChain, setEvoChain] = useState([]);
  const [loading, setLoading] = useState(true);

  const mainType = pokemon.tipos[0] || 'normal';
  const colorBase = COLORS[mainType];
  const art = fullDetail?.sprites.other['official-artwork'].front_default;

  const fetchRetry = useCallback(async (url, attempts = 0) => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP: ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempts < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (2 ** attempts)));
        return fetchRetry(url, attempts + 1);
      }
      throw new Error(`Failed to fetch ${url}.`);
    }
  }, []);

  const fetchVarieties = useCallback(async (speciesUrl) => {
    const speciesData = await fetchRetry(speciesUrl);
    const varietyUrls = speciesData.varieties.map(v => v.pokemon.url);
    const details = await Promise.all(varietyUrls.map(url => fetchRetry(url)));

    const varieties = details.map(d => ({
      id: d.id,
      nombre: d.name,
      gif: d.sprites.versions['generation-v']['black-white'].animated.front_default || d.sprites.front_default,
      tipos: d.types.map(t => t.type.name),
      is_default: d.is_default,
    })).filter(v => v.gif || v.is_default);
    return { species_name: speciesData.name, varieties };
  }, [fetchRetry]);

  const parseChain = useCallback(async (chain) => {
    const speciesUrls = [];
    const collectSpecies = (stage) => {
      if (!speciesUrls.includes(stage.species.url)) speciesUrls.push(stage.species.url);
      if (stage.evolves_to && stage.evolves_to.length > 0) stage.evolves_to.forEach(collectSpecies);
    };
    collectSpecies(chain);
    return await Promise.all(speciesUrls.map(fetchVarieties));
  }, [fetchVarieties]);


  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      try {
        const det = await fetchRetry(pokemon.urlDetalle);
        const spec = await fetchRetry(det.species.url);
        const chainData = await fetchRetry(spec.evolution_chain.url);
        const parsedChain = await parseChain(chainData.chain);
        setEvoChain(parsedChain);
        setFullDetail(det);
      } catch (error) {
        console.error("Error loading details:", error);
      } finally {
        setLoading(false);
      }
    };
    if (pokemon) loadDetails();
  }, [pokemon, parseChain, fetchRetry]);

  const getVarietyName = (specName, varName) => {
    if (varName === specName) return 'Base';
    let name = varName.replace(new RegExp(`^${specName}-`), '');
    if (name.startsWith('cap')) name = name.replace('cap', 'gorra');
    return capitalizar(name.replace('-', ' '));
  };

  const statBarColor = (stat) => stat > 70 ? '#4ade81' : '#f87171';
  const handleError = (e) => { e.target.onerror = null; e.target.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`; };

  return (
    <div className="modal-overlay" onClick={alCerrarModal}>
      <div className="modal-content detail-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ color: colorBase, fontWeight: '800' }}>
            {capitalizar(pokemon.nombre)} <span style={{ fontSize: '0.8em', color: '#9ca3af', fontWeight: '400' }}>Nº {String(pokemon.id).padStart(3, '0')}</span>
          </h2>

          <div style={{ display: 'flex', gap: '8px' }}>
            {/* Botón de favorito en el modal de detalle */}
            <button
              onClick={() => toggleFav(pokemon)}
              className="fav-button-lg"
              style={{ backgroundColor: isFav(pokemon.id) ? '#dc2626' : '#f4ececff', color: 'white', padding: '8px', borderRadius: '50%', border: 'none', transition: 'background-color 0.2s' }}
              aria-label={isFav(pokemon.id) ? "Eliminar de favoritos" : "Agregar a favoritos"}
            >
              <IconoCorazon solido={true} color="white" />
            </button>
            <button onClick={alCerrarModal} className="modal-close-button"><IconoCerrar /></button>
          </div>

        </div>

        {loading ? (<div style={{ padding: '48px', textAlign: 'center' }}>Cargando detalles...</div>) : (
          <div className="detail-grid" style={{ marginTop: '16px' }}>
            <div style={{ gridColumn: 'span 1' }}>
              <div style={{ padding: '16px', borderRadius: '12px', boxShadow: '0 0 10px rgba(0,0,0,0.1) inset', backgroundColor: `${colorBase}20`, height: '256px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <img src={art} alt={pokemon.nombre} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', filter: 'drop-shadow(0 8px 6px rgba(0,0,0,0.2))' }} />
              </div>

              <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', backgroundColor: '#05203bff' }} className="dark:bg-gray-700">
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Datos</h3>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', padding: '4px 0' }}><span>Peso:</span><span>{pokemon.peso} kg</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', padding: '4px 0' }}><span>Altura:</span><span>{pokemon.altura} m</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}><span>Tipos:</span>
                  <div className="type-list">
                    {pokemon.tipos.map(t => (<span key={t} className="type-badge" style={{ backgroundColor: COLORS[t] }}>{capitalizar(t)}</span>))}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Estadísticas Base</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {fullDetail.stats.map(s => (
                    <div key={s.stat.name} className="stat-bar-container">
                      <span className="stat-name">{capitalizar(s.stat.name.replace('-', ' '))}</span>
                      <span className="stat-value">{s.base_stat}</span>
                      <div className="stat-bar">
                        <div className="stat-bar-fill" style={{ width: `${Math.min(100, (s.base_stat / 255) * 100)}%`, backgroundColor: statBarColor(s.base_stat) }}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px' }}>Cadena Evolutiva</h3>
                <div className="evo-chain-container">
                  {evoChain.map((species, i) => (
                    <React.Fragment key={species.species_name}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <h4 className="species-title">{capitalizar(species.species_name)}</h4>
                        <div className="variety-list">
                          {species.varieties.map(evo => (
                            <div key={evo.id}
                              className={`variety-item ${evo.id === pokemon.id ? 'current' : ''}`}
                              onClick={() => evo.id !== pokemon.id && alSeleccionarEvolucion(evo.id)}
                            >
                              <div className="variety-img-wrap">
                                <img src={evo.gif} alt={evo.nombre} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={handleError} />
                              </div>
                              <span className="variety-name">{getVarietyName(species.species_name, evo.nombre)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {i < evoChain.length - 1 && (<span style={{ fontSize: '3rem', alignSelf: 'center', opacity: 0.5 }}>&rarr;</span>)}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};


// --- 8. COMPONENTE PRINCIPAL (APP) ---
export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('pokedex_tema') || T_DARK);
  const [route, setRoute] = useState(R_MAIN);
  const [selectedPoke, setSelectedPoke] = useState(null);
  const [advancedSearchOpen, setAdvancedSearchOpen] = useState(false);

  const { viewList, favs, loading, totalFound, types, query, setQuery, filters, setFilters, page, totalPages, changePage, toggleFav, feedback, fetchDetailById } = usePokedex();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === T_DARK);
    localStorage.setItem('pokedex_tema', theme);
  }, [theme]);

  const changeTheme = () => setTheme(p => p === T_DARK ? 'claro' : T_DARK);

  const isFav = useCallback((id) => favs.some(f => f.id === id), [favs]);

  const currentList = useMemo(() => {
    // En la ruta de favoritos, usamos la lista de favoritos.
    if (route === R_FAVS) return favs;

    // En la ruta principal, usamos la lista de la vista (paginada/filtrada).
    return viewList;
  }, [route, favs, viewList]);

  const status = useMemo(() => {
    const activeFilters = Object.values(filters).filter(f => f !== null).length > 0;
    if (route === R_FAVS) return { title: "Mis Favoritos", subtitle: `${favs.length} Pokémon especiales.` };
    if (query) return { title: "Búsqueda Rápida", subtitle: `Resultados para: "${query}" (${totalFound} encontrados)` };
    if (activeFilters) return { title: "Filtro Avanzado", subtitle: `Mostrando ${viewList.length} Pokémon filtrados en esta página.` };
    return { title: "Pokédex Nacional", subtitle: `Explora ${totalFound} Pokémon. Página ${page} de ${totalPages}.` };
  }, [route, filters, query, totalFound, page, totalPages, favs.length, viewList.length]);

  const handleSearch = (e) => {
    setQuery(e.target.value);
    setFilters({ tipo: null, pesoMin: null, pesoMax: null, alturaMin: null, alturaMax: null });
    setRoute(R_MAIN);
    changePage(1);
  };

  const applyFilters = (newFilters) => {
    setQuery('');
    setFilters(newFilters);
    setRoute(R_MAIN);
    changePage(1);
  };

  const selectPokemon = useCallback(async (id) => {
    setSelectedPoke(null);
    // Intentar buscar en la lista actual, si no, buscar con el hook
    const localPoke = [...viewList, ...favs].find(p => p.id === id);
    try {
      const poke = localPoke || await fetchDetailById(id);
      if (poke) setSelectedPoke(poke);
    } catch (e) {
      console.error("Selection error:", e);
    }
  }, [viewList, favs, fetchDetailById]);


  return (
    <div className="app-container">
      {/* --- ESTILOS CSS PURO --- */}
      <style jsx="true">{`
                /* Base y Tema */
                .app-container {
                    min-height: 100vh;
                    font-family: 'Inter', sans-serif;
                    background-color: white;
                    color: #1f2937;
                    transition: background-color 0.3s, color 0.3s;
                    padding: 16px; /* Padding general */
                }
                .dark .app-container {
                    background-color: #111827;
                    color: #f3f4f6;
                }
                
                /* Contenedor principal centrado y con ancho limitado para escritorios */
                .main-content-wrap { 
                    width: 100%; 
                    max-width: 1280px; /* Ancho máximo para centrar en pantallas grandes */
                    margin: 0 auto; /* Centrado automático */
                    padding: 16px 0; /* Padding vertical, ya hay padding horizontal en .app-container */
                }
                @media (min-width: 640px) { .main-content-wrap { padding: 32px 0; } }


                /* Header y Controles */
                .header-container {
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 24px;
                    gap: 16px;
                }
                @media (min-width: 640px) { .header-container { flex-direction: row; } }
                
                .search-controls { display: flex; width: 100%; gap: 8px; align-items: center; }
                @media (min-width: 640px) { .search-controls { width: auto; } }
                
                .search-input { padding: 12px; border-radius: 12px; border: 1px solid #d1d5db; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); background-color: white; transition: all 0.2s; }
                .dark .search-input { background-color: #1f2937; border-color: #374151; color: white; }
                .search-input:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.5); outline: none; }
                
                .action-button { padding: 12px 18px; background-color: #ef4444; color: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3); transition: all 0.2s; font-weight: 700; border: none; }
                .action-button:hover { background-color: #dc2626; transform: translateY(-1px); }
                .nav-group { display: flex; gap: 12px; width: 100%; }
                @media (min-width: 640px) { .nav-group { width: auto; } }
                
                .nav-button { padding: 8px 16px; font-weight: 700; border-radius: 12px; transition: all 0.3s; display: flex; align-items: center; gap: 4px; border: none; }
                .nav-button.active { background-color: #ef4444; color: white; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3); }
                .nav-button:not(.active) { background-color: #e5e7eb; color: #374151; }
                .dark .nav-button:not(.active) { background-color: #374151; color: #d1d5db; }
                .nav-button:not(.active):hover { background-color: #d1d5db; }
                .dark .nav-button:not(.active):hover { background-color: #4b5563; }

                /* Títulos de Estado (Reubicados) */
                .status-title-group { 
                    margin-bottom: 16px; 
                    border-bottom: 1px solid #e5e7eb; 
                    padding-bottom: 8px;
                    text-align: center; /* Centrado del texto */
                }
                .dark .status-title-group { border-bottom: 1px solid #374151; }
                .status-title { font-size: 1.875rem; font-weight: 900; color: #dc2626; }
                .dark .status-title { color: #f87171; }
                .status-subtitle { font-size: 0.875rem; color: #6b7280; }
                .dark .status-subtitle { color: #d1d5db; }

                /* Grid de Tarjetas (Ajustado para 150px) */
                .card-grid { 
                    display: grid; 
                    /* Usamos auto-fit para que quepan tantos de 150px como sea posible, y se centran */
                    grid-template-columns: repeat(auto-fit, 200px); 
                    gap: 12px; 
                    justify-content: center; 
                }

                /* FICHA DE POKÉMON (Nueva altura/ancho fijo) */
                .pokemon-card { 
                    width: 200px;
                    height: 80px;
                    padding: 6px; 
                    border-radius: 8px; 
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1); 
                    cursor: pointer; 
                    transform: scale(1); 
                    transition: all 0.3s; 
                    border: 0px solid; 
                    display: flex; 
                    align-items: center;
                    gap: 4px; /* Espacio entre imagen y contenido */
                    flex-shrink: 0;
                    overflow: hidden;
                }
                .pokemon-card:hover { transform: scale(1.05); }

                .card-img-container { 
                    width: 60px; 
                    height: 60px; 
                    display: flex; 
                    justify-content: center; 
                    align-items: center; 
                    flex-shrink: 0;
                    border-radius: 4px;
                }
                .card-img { 
                    width: 100%; 
                    height: 100%; 
                    object-fit: contain; 
                    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2)); 
                }

                .card-content-wrap { /* Contenedor para el texto y botón */
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    height: 100%;
                    overflow: hidden;
                    padding-top: 2px;
                    padding-bottom: 2px;
                }

                .card-header { 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: flex-start; 
                    line-height: 1.1; 
                    /* Utilizamos flex para forzar que el corazón y la info de texto estén en línea */
                    width: 100%; 
                }
                
                .card-info-text {
                    /* Permite que esta sección ocupe el espacio principal */
                    flex-grow: 1;
                    /* Asegura que el texto se mantenga dentro de este contenedor antes de elipsis */
                    min-width: 0;
                }

                .card-id { 
                    font-size: 10px; 
                    font-weight: 700; 
                    opacity: 0.7; 
                    color: #4b5563; 
                    display: block;
                }
                .dark .card-id { color: #d1d5db; }

                .card-name { 
                    font-size: 11px; 
                    font-weight: 800; 
                    color: black; 
                    white-space: nowrap; 
                    overflow: hidden; 
                    text-overflow: ellipsis; 
                    line-height: 1.1;
                    max-width: 100%; /* Importante para que funcione text-overflow */
                }
                .dark .card-name { color: white; }
                
                .fav-button { 
                    padding: 0; 
                    color: #ef4444; 
                    flex-shrink: 0; 
                    border: none; 
                    background: none; 
                    margin-left: 4px; 
                    /* Asegura que el corazón siempre tenga un ancho reservado y no colapse */
                    flex-basis: 16px; 
                    height: 16px; 
                }
                .fav-button .corazon-icono { width: 12px; height: 12px; }

                /* Tipo Compacto (Nuevo) */
                .type-list-compact { 
                    display: flex; 
                    justify-content: flex-start; 
                    margin-top: 4px; 
                }
                .type-badge-small { 
                    font-size: 10px; 
                    font-weight: 600; 
                    padding: 2px 6px; 
                    border-radius: 6px; 
                    color: white; 
                    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); 
                    line-height: 1;
                }

                /* Paginación */
                .pagination-container { display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
                .page-button { padding: 8px 12px; border-radius: 9999px; font-size: 14px; font-weight: 600; transition: all 0.15s; border: 1px solid #d1d5db; }
                .page-button.nav { background-color: #e5e7eb; color: #4b5563; border: none; }
                .dark .page-button.nav { background-color: #374151; color: #d1d5db; }
                .page-button.active { background-color: #ef4444; color: white; border-color: #ef4444; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.3); }
                .page-button:not(.active) { background-color: white; color: #ef4444; border-color: #fca5a5; }
                .dark .page-button:not(.active) { background-color: #1f2937; color: #f87171; border-color: #4b5563; }
                .page-button:disabled { opacity: 0.5; cursor: default; }

                /* Modales (Sin cambios relevantes) */
                .modal-overlay { position: fixed; inset: 0; z-index: 50; padding: 16px; overflow-y: auto; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; }
                .dark .modal-overlay { background-color: rgba(0, 0, 0, 0.9); }
                .modal-content { width: 100%; max-width: 480px; margin-top: 48px; background-color: white; border-radius: 12px; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5); padding: 24px; transition: all 0.3s; }
                .dark .modal-content { background-color: #1f2937; }
                .detail-modal-content { max-width: 1024px; } 

                .modal-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #e5e7eb; margin-bottom: 16px;}
                .dark .modal-header { border-bottom: 1px solid #374151; }
                .modal-title { font-size: 1.5rem; font-weight: 800; color: #ef4444; }
                .dark .modal-title { color: #f87171; }
                .modal-close-button { padding: 8px; border-radius: 9999px; transition: background-color 0.2s; color: #4b5563; border: none; background: none; }
                .modal-close-button:hover { background-color: #e5e7eb; }
                .dark .modal-close-button:hover { background-color: #374151; }
                
                .form-label { display: block; font-size: 1.125rem; font-weight: 500; margin-bottom: 8px; color: #1f2937; }
                .dark .form-label { color: white; }
                .form-input-group { display: flex; gap: 16px; }
                .form-input, .form-select { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background-color: white; color: #1f2937; }
                .dark .form-input, .dark .form-select { border-color: #374151; background-color: #374151; color: white; }
                
                .modal-actions { padding-top: 16px; border-top: 1px solid #e5e7eb; display: flex; justify-content: flex-end; margin-top: 24px;}
                .dark .modal-actions { border-top: 1px solid #374151; }
                
                /* Detalle Modal */
                .detail-grid {
                  display: grid;
                  gap: 24px;
                }
                @media (min-width: 1024px) {
                  .detail-grid {
                    grid-template-columns: repeat(3, 1fr);
                  }
                }
                .type-list {
                  display: flex;
                  justify-content: flex-end;
                  gap: 4px;
                  margin-top: 0;
                }
                .type-badge {
                  font-size: 12px;
                  font-weight: 600;
                  padding: 2px 8px;
                  border-radius: 9999px;
                  color: white;
                  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
                }

                .stat-bar-container {
                  display: flex;
                  align-items: center;
                  margin-bottom: 8px;
                }
                .stat-name {
                  width: 25%;
                  font-weight: 600;
                  font-size: 0.875rem;
                  color: #4b5563;
                }
                .dark .stat-name {
                  color: #d1d5db;
                }
                .stat-value {
                  width: 8.333333%;
                  text-align: center;
                  font-size: 0.875rem;
                  font-weight: 700;
                }
                .stat-bar {
                  width: 66.666667%;
                  height: 8px;
                  border-radius: 9999px;
                  background-color: #e5e7eb;
                  margin-left: 8px;
                  }
                .dark .stat-bar { background-color: #374151; }
                .stat-bar-fill { height: 100%; border-radius: 9999px; transition: width 0.5s; }

                .evo-chain-container { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; justify-content: center; background-color: #f9fafb; padding: 16px; border-radius: 8px; }
                .dark .evo-chain-container { background-color: #374151; }
                .species-title { font-size: 1.125rem; font-weight: 800; margin-bottom: 8px; color: #dc2626; }
                
                .variety-list { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
                .variety-item { display: flex; flex-direction: column; align-items: center; padding: 8px; border-radius: 8px; border: 2px solid transparent; transition: all 0.3s; }
                .variety-item:not(.current):hover { cursor: pointer; transform: scale(1.05); background-color: #f3f4f6; }
                .variety-item.current { background-color: #fee2e2; border-color: #f87171; cursor: default; }
                .dark .variety-item.current { background-color: rgba(185, 28, 28, 0.2); }
                .variety-img-wrap { width: 64px; height: 64px; padding: 4px; background-color: white; border-radius: 9999px; display: flex; justify-content: center; align-items: center; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .variety-name { font-size: 0.75rem; margin-top: 4px; color: #4b5563; text-align: center; max-width: 80px; }
                
                /* Estilo para el botón de favorito grande */
                .fav-button-lg:hover { background-color: #ef4444 !important; transform: scale(1.05); }
                .fav-button-lg .corazon-icono { width: 20px; height: 20px; }

                /* Feedback Toast */
                .feedback-toast { position: fixed; bottom: 16px; right: 16px; z-index: 50; padding: 12px; border-radius: 8px; box-shadow: 0 10px 15px rgba(0, 0, 0, 0.3); color: white; transition: all 0.3s; }
                .feedback-toast.success { background-color: #10b981; }
                .feedback-toast.error { background-color: #ef4444; }
            `}</style>

      {/* --- CONTENIDO DE LA APP --- */}

      {/* Se elimina el sidebar estático */}

      <div className="main-content-wrap">
        <header className="header-container">
          <div className="search-controls">
            <input type="text" placeholder="Buscar por nombre o ID..." value={query} onChange={handleSearch} className="search-input" />
            <button onClick={() => setAdvancedSearchOpen(true)} className="action-button" style={{ padding: '12px' }} aria-label="Búsqueda Avanzada">
              <IconoFiltro />
            </button>
          </div>

          <div className="nav-group">
            <button onClick={() => { setRoute(R_MAIN); changePage(1); }} className={`nav-button ${route === R_MAIN ? 'active' : ''}`}>Pokédex</button>
            <button onClick={() => { setRoute(R_FAVS); setQuery(''); setFilters({ tipo: null, pesoMin: null, pesoMax: null, alturaMin: null, alturaMax: null }); }} className={`nav-button ${route === R_FAVS ? 'active' : ''}`}>
              <IconoCorazon solido={route === R_FAVS} color={route === R_FAVS ? 'white' : 'currentColor'} /> Favs ({favs.length})
            </button>
            <button onClick={changeTheme} className="nav-button" style={{ padding: '12px', flexShrink: 0 }} aria-label="Cambiar tema">{theme === T_DARK ? '🌞' : '🌙'}</button>
          </div>
        </header>

        {/* Título de Estado centrado, ya no requiere lógica de visibilidad condicional */}
        <div className="status-title-group">
          <h2 className="status-title">{status.title}</h2>
          <p className="status-subtitle">{status.subtitle}</p>
        </div>

        {route === R_MAIN && !loading && totalPages > 1 && (<Paginacion page={page} totalPages={totalPages} changePage={changePage} />)}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', fontSize: '1.25rem', fontWeight: '600' }}>Cargando...</div>
        ) : currentList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#6b7280' }}>No se encontraron Pokémon.</div>
        ) : (
          <div className="card-grid">
            {currentList.map(p => (
              // Pasar el ID del Pokémon para la selección y la función isFav para el estado del corazón
              <FichaPokemon
                key={p.id}
                pokemon={p}
                isFav={isFav(p.id)}
                onSelect={() => selectPokemon(p.id)}
                onFavClick={toggleFav}
              />
            ))}
          </div>
        )}

        {route === R_MAIN && !loading && totalPages > 1 && (<Paginacion page={page} totalPages={totalPages} changePage={changePage} />)}
      </div>

      {feedback && (
        <div className={`feedback-toast ${feedback.type}`}>
          {feedback.txt}
        </div>
      )}

      {selectedPoke && (
        <ModalDetallePokemon
          pokemon={selectedPoke}
          alCerrarModal={() => setSelectedPoke(null)}
          alSeleccionarEvolucion={selectPokemon}
          fetchDetailById={fetchDetailById}
          isFav={isFav} // Pasa la función para verificar si es favorito
          toggleFav={toggleFav} // Pasa la función para alternar el favorito
        />
      )}

      <ModalBusquedaAvanzada
        estaAbierto={advancedSearchOpen}
        alCerrar={() => setAdvancedSearchOpen(false)}
        tiposDisponibles={types}
        filtrosActuales={filters}
        alAplicarFiltros={applyFilters}
      />
    </div>
  );
}