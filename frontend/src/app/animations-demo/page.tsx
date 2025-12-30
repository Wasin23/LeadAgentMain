'use client';

import { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UsersIcon, ComputerDesktopIcon, ChartPieIcon, Cog6ToothIcon, BookOpenIcon } from '@heroicons/react/24/outline';
import UserMenu from '@/components/UserMenu';
import api from '@/lib/api';
import { geoOrthographic, geoPath, geoGraticule, geoMercator, geoAlbersUsa } from 'd3-geo';
import { feature } from 'topojson-client';

// Using Natural Earth 110m world data (simplified for performance)
// This is a simplified TopoJSON representation
const worldData = {
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "United States" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-125, 50], [-125, 48], [-124, 46], [-123, 45], [-122, 44], [-121, 43],
          [-120, 42], [-119, 41], [-117, 39], [-115, 37], [-114, 36], [-113, 35],
          [-111, 33], [-109, 32], [-106, 31], [-104, 30], [-102, 29], [-100, 28.5],
          [-98, 28], [-96, 28.5], [-95, 29], [-94, 29.5], [-93, 30], [-91, 30],
          [-89, 29], [-88, 29.5], [-87, 30], [-86, 30.5], [-85, 31], [-84, 31],
          [-83, 31], [-82, 30.5], [-81, 30], [-80, 29], [-80, 27], [-80, 26],
          [-80.5, 25], [-81, 24.5], [-82, 25], [-83, 25.5], [-84, 26], [-85, 26.5],
          [-86, 27], [-87, 28], [-88, 28.5], [-89, 28.5], [-90, 28.5], [-91, 29],
          [-92, 29], [-93, 29.5], [-94, 30], [-95, 30], [-96, 30.5], [-97, 31],
          [-98, 31.5], [-99, 32], [-100, 32.5], [-101, 33], [-102, 34], [-103, 35],
          [-104, 36], [-105, 37], [-106, 38], [-107, 39], [-108, 40], [-109, 41],
          [-110, 42], [-111, 43], [-112, 44], [-113, 45], [-114, 46], [-115, 47],
          [-116, 47.5], [-117, 48], [-118, 48.5], [-119, 48.5], [-120, 49],
          [-121, 49], [-122.5, 49], [-123.5, 49], [-124.5, 49], [-125, 50]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Canada" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-141, 69], [-141, 60], [-139, 60], [-137, 59], [-135, 59], [-133, 58],
          [-131, 57], [-129, 56], [-127, 55], [-125, 54], [-123, 53], [-122, 52],
          [-121, 51], [-120, 50], [-119, 49], [-95, 49], [-95, 50], [-94, 51],
          [-93, 52], [-92, 53], [-90, 54], [-88, 55], [-86, 56], [-84, 57],
          [-82, 58], [-80, 59], [-78, 60], [-76, 61], [-74, 62], [-72, 63],
          [-70, 64], [-68, 65], [-66, 66], [-64, 67], [-62, 68], [-60, 69],
          [-58, 70], [-56, 71], [-55, 72], [-60, 75], [-65, 77], [-70, 78],
          [-75, 79], [-80, 80], [-85, 81], [-90, 82], [-95, 82], [-100, 81],
          [-105, 80], [-110, 79], [-115, 78], [-120, 76], [-125, 74], [-130, 72],
          [-135, 70], [-141, 69]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Mexico" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-117, 32], [-115, 32], [-113, 31], [-111, 30], [-109, 29], [-107, 28],
          [-105, 27], [-103, 26], [-101, 25], [-99, 24], [-97, 23], [-95, 22],
          [-93, 21], [-91, 20], [-90, 19], [-89, 18], [-89, 17], [-90, 16],
          [-91, 16], [-92, 16], [-93, 16], [-94, 16.5], [-95, 17], [-96, 17.5],
          [-97, 18], [-98, 18.5], [-99, 19], [-100, 19.5], [-101, 20], [-102, 21],
          [-103, 22], [-104, 23], [-105, 24], [-106, 25], [-107, 26], [-108, 27],
          [-109, 28], [-110, 28.5], [-111, 29], [-112, 29.5], [-113, 30],
          [-114, 30.5], [-115, 31], [-116, 31.5], [-117, 32]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Brazil" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-73, 5], [-70, 3], [-68, 1], [-66, -1], [-64, -3], [-62, -5], [-60, -7],
          [-58, -10], [-57, -13], [-56, -16], [-55, -19], [-54, -22], [-53, -25],
          [-52, -27], [-51, -29], [-50, -31], [-49, -32], [-48, -33], [-47, -33],
          [-46, -33], [-45, -33], [-44, -32], [-43, -31], [-42, -29], [-41, -27],
          [-40, -25], [-39, -23], [-38, -21], [-37, -19], [-36, -17], [-35, -15],
          [-35, -10], [-35, -5], [-36, 0], [-37, 3], [-40, 4], [-43, 4], [-46, 3],
          [-49, 2], [-52, 1], [-55, 0], [-58, -1], [-61, -1], [-64, 0], [-67, 1],
          [-70, 2], [-72, 3.5], [-73, 5]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Russia" },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[
          [40, 50], [45, 52], [50, 53], [55, 54], [60, 55], [65, 56], [70, 57],
          [75, 58], [80, 59], [85, 60], [90, 61], [95, 62], [100, 63], [105, 64],
          [110, 65], [115, 66], [120, 67], [125, 68], [130, 69], [135, 70],
          [140, 70], [145, 70], [150, 70], [155, 69], [160, 68], [165, 67],
          [170, 66], [175, 65], [180, 64], [180, 70], [175, 72], [170, 74],
          [165, 75], [160, 76], [155, 77], [150, 78], [145, 78], [140, 78],
          [135, 77], [130, 76], [125, 75], [120, 74], [115, 73], [110, 72],
          [105, 71], [100, 70], [95, 69], [90, 68], [85, 67], [80, 66], [75, 65],
          [70, 64], [65, 63], [60, 62], [55, 61], [50, 60], [45, 58], [40, 56],
          [35, 54], [30, 52], [30, 50], [35, 50], [40, 50]
        ]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "China" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [75, 40], [80, 42], [85, 44], [90, 45], [95, 46], [100, 47], [105, 48],
          [110, 49], [115, 50], [120, 51], [123, 52], [125, 53], [127, 53],
          [130, 52], [132, 50], [134, 48], [135, 45], [135, 42], [134, 39],
          [132, 36], [130, 33], [128, 30], [126, 27], [124, 24], [122, 22],
          [120, 20], [118, 19], [115, 19], [112, 20], [110, 22], [108, 24],
          [106, 26], [104, 28], [102, 30], [100, 31], [98, 32], [96, 32],
          [94, 31], [92, 30], [90, 29], [88, 29], [86, 30], [84, 31], [82, 32],
          [80, 33], [78, 35], [76, 37], [75, 40]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Australia" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [113, -22], [115, -24], [117, -26], [119, -28], [121, -30], [123, -32],
          [125, -34], [127, -35], [129, -36], [131, -37], [133, -37.5], [135, -38],
          [137, -38], [139, -37.5], [141, -37], [143, -36], [145, -35], [147, -34],
          [148, -32], [149, -30], [150, -28], [151, -26], [152, -24], [153, -22],
          [153, -20], [153, -18], [153, -16], [153, -14], [152, -12], [151, -11],
          [149, -11], [147, -11.5], [145, -12], [143, -12.5], [141, -13],
          [139, -13], [137, -13], [135, -13], [133, -13.5], [131, -14],
          [129, -14.5], [127, -15], [125, -16], [123, -17], [121, -18], [119, -19],
          [117, -20], [115, -21], [113, -22]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "India" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [68, 35], [70, 36], [72, 36], [74, 35], [76, 34], [78, 33], [80, 32],
          [82, 31], [84, 30], [86, 29], [88, 28], [89, 27], [90, 26], [91, 25],
          [92, 23], [93, 21], [93, 19], [93, 17], [93, 15], [92, 13], [91, 11],
          [90, 9], [89, 8], [87, 8], [85, 9], [83, 10], [81, 11], [79, 12],
          [77, 13], [75, 15], [74, 17], [73, 19], [72, 21], [71, 23], [70, 25],
          [69, 27], [68, 29], [68, 31], [68, 33], [68, 35]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Argentina" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [-73, -22], [-71, -24], [-69, -26], [-68, -28], [-67, -30], [-66, -32],
          [-65, -34], [-65, -36], [-65, -38], [-65, -40], [-66, -42], [-67, -44],
          [-68, -46], [-69, -48], [-70, -50], [-71, -52], [-72, -53], [-73, -54],
          [-74, -54], [-73, -53], [-72, -52], [-71, -51], [-70, -50], [-69, -48],
          [-68, -46], [-67, -44], [-66, -42], [-66, -40], [-66, -38], [-67, -36],
          [-68, -34], [-69, -32], [-70, -30], [-71, -28], [-72, -26], [-73, -24],
          [-73, -22]
        ]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "South Africa" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[
          [16, -29], [18, -30], [20, -31], [22, -32], [24, -33], [26, -33.5],
          [28, -33.5], [30, -33], [31, -32], [32, -31], [32, -29], [32, -27],
          [31, -25], [30, -23], [29, -22], [27, -22], [25, -23], [23, -24],
          [21, -25], [19, -26], [17, -27], [16, -28], [16, -29]
        ]]
      }
    }
  ]
};

export default function InteractiveGlobe() {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragged, setHasDragged] = useState(false);
  const [rotation, setRotation] = useState<[number, number]>([-100, -10]);
  const rotationRef = useRef<[number, number]>([-100, -10]);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [provinceData, setProvinceData] = useState<any>(null);

  // Real stats data
  const [stats, setStats] = useState({
    emailsQueued: 0,
    emailsSent: 0,
    emailsViewed: 0,
    alerts: 0
  });

  // Modal states
  const [selectedQueue, setSelectedQueue] = useState<{agentId: string | 'all', type: 'queued' | 'sent' | 'replied', agentName: string} | null>(null);
  const [queueEmails, setQueueEmails] = useState<any[]>([]);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<{id: string, subject: string, body: string, to: string, cc?: string, bcc?: string} | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);

  // Satellite and agent positioning
  const [showIdleAgents, setShowIdleAgents] = useState(false);
  const [satelliteBob, setSatelliteBob] = useState(0);
  const [agentActivities, setAgentActivities] = useState<{[agentId: string]: any}>({});
  
  // Email location tracking with status (queued, sent, meeting)
  const [emailDots, setEmailDots] = useState<Array<{
    id: string;
    location: { lat: number; lng: number; city?: string; state?: string; country?: string; companyName?: string };
    subject: string;
    to: string;
    agentName: string;
    timestamp: number;
    status: 'queued' | 'sent' | 'meeting';
  }>>([]);

  // City and state geocoding function with detailed US city coordinates
  const geocodeLocation = (location: any): { lat: number; lng: number } | null => {
    if (!location) return null;
    
    const { city, state, country } = location;
    
    // Major US cities with accurate coordinates
    const cityCenters: {[key: string]: {lat: number, lng: number}} = {
      // California cities
      'Irvine': {lat: 33.6846, lng: -117.8265},
      'Los Angeles': {lat: 34.0522, lng: -118.2437},
      'San Francisco': {lat: 37.7749, lng: -122.4194},
      'San Diego': {lat: 32.7157, lng: -117.1611},
      'San Jose': {lat: 37.3382, lng: -121.8863},
      'Sacramento': {lat: 38.5816, lng: -121.4944},
      'Oakland': {lat: 37.8044, lng: -122.2712},
      'Fresno': {lat: 36.7378, lng: -119.7871},
      'Long Beach': {lat: 33.7701, lng: -118.1937},
      'Santa Clara': {lat: 37.3541, lng: -121.9552},
      'Palo Alto': {lat: 37.4419, lng: -122.1430},
      'Sunnyvale': {lat: 37.3688, lng: -122.0363},
      'Mountain View': {lat: 37.3861, lng: -122.0839},
      'Cupertino': {lat: 37.3230, lng: -122.0322},
      
      // Texas cities
      'Houston': {lat: 29.7604, lng: -95.3698},
      'Dallas': {lat: 32.7767, lng: -96.7970},
      'Austin': {lat: 30.2672, lng: -97.7431},
      'San Antonio': {lat: 29.4241, lng: -98.4936},
      'Fort Worth': {lat: 32.7555, lng: -97.3308},
      
      // Other major cities
      'New York': {lat: 40.7128, lng: -74.0060},
      'Chicago': {lat: 41.8781, lng: -87.6298},
      'Phoenix': {lat: 33.4484, lng: -112.0740},
      'Philadelphia': {lat: 39.9526, lng: -75.1652},
      'Miami': {lat: 25.7617, lng: -80.1918},
      'Atlanta': {lat: 33.7490, lng: -84.3880},
      'Boston': {lat: 42.3601, lng: -71.0589},
      'Seattle': {lat: 47.6062, lng: -122.3321},
      'Denver': {lat: 39.7392, lng: -104.9903},
      'Washington': {lat: 38.9072, lng: -77.0369},
      'Detroit': {lat: 42.3314, lng: -83.0458},
      'Portland': {lat: 45.5152, lng: -122.6784},
      'Las Vegas': {lat: 36.1699, lng: -115.1398},
    };
    
    // Try to find city first (more accurate)
    if (city && cityCenters[city]) {
      return cityCenters[city];
    }
    
    // Fall back to state centers
    const stateCenters: {[key: string]: {lat: number, lng: number}} = {
      'California': {lat: 36.7783, lng: -119.4179}, 'CA': {lat: 36.7783, lng: -119.4179},
      'Texas': {lat: 31.9686, lng: -99.9018}, 'TX': {lat: 31.9686, lng: -99.9018},
      'Florida': {lat: 27.6648, lng: -81.5158}, 'FL': {lat: 27.6648, lng: -81.5158},
      'New York': {lat: 40.7128, lng: -74.0060}, 'NY': {lat: 40.7128, lng: -74.0060},
      'Pennsylvania': {lat: 41.2033, lng: -77.1945}, 'PA': {lat: 41.2033, lng: -77.1945},
      'Illinois': {lat: 40.6331, lng: -89.3985}, 'IL': {lat: 40.6331, lng: -89.3985},
      'Ohio': {lat: 40.4173, lng: -82.9071}, 'OH': {lat: 40.4173, lng: -82.9071},
      'Georgia': {lat: 32.1656, lng: -82.9001}, 'GA': {lat: 32.1656, lng: -82.9001},
      'North Carolina': {lat: 35.7596, lng: -79.0193}, 'NC': {lat: 35.7596, lng: -79.0193},
      'Michigan': {lat: 44.3148, lng: -85.6024}, 'MI': {lat: 44.3148, lng: -85.6024},
      'Massachusetts': {lat: 42.4072, lng: -71.3824}, 'MA': {lat: 42.4072, lng: -71.3824},
      'Washington': {lat: 47.7511, lng: -120.7401}, 'WA': {lat: 47.7511, lng: -120.7401},
      'Colorado': {lat: 39.5501, lng: -105.7821}, 'CO': {lat: 39.5501, lng: -105.7821},
      'Arizona': {lat: 34.0489, lng: -111.0937}, 'AZ': {lat: 34.0489, lng: -111.0937},
      'Virginia': {lat: 37.4316, lng: -78.6569}, 'VA': {lat: 37.4316, lng: -78.6569},
    };
    
    // Try state first
    if (state && stateCenters[state]) {
      return stateCenters[state];
    }
    
    // Default to central US if no specific location
    return { lat: 39.8283, lng: -98.5795 };
  };

  // Animate satellite bobbing
  useEffect(() => {
    let angle = 0;
    const interval = setInterval(() => {
      angle += 0.05;
      setSatelliteBob(Math.sin(angle) * 10); // Bobs up and down 10px
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Connect to SSE for agent activities
  useEffect(() => {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    const authToken = localStorage.getItem('authToken');
    const eventSource = new EventSource(`${backendUrl}/api/monitoring/stream?token=${encodeURIComponent(authToken || '')}`);
    
    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📡 SSE Event received:', data);
        const activityData = data.type === 'agent_activity' ? data : 
                            (data.type === 'activity_added' && data.data?.type === 'agent_activity') ? data.data : 
                            null;
        
        if (activityData && activityData.agentId) {
          setAgentActivities(prev => ({
            ...prev,
            [activityData.agentId]: {
              status: activityData.cardMessage || activityData.details,
              timestamp: Date.now(),
              location: activityData.location || null,
              targeting: activityData.targeting || null,
              isActive: true
            }
          }));

          // Update agent in agents list
          setAgents(prev => prev.map(agent => 
            agent.agentId === activityData.agentId
              ? { ...agent, currentActivity: activityData.cardMessage || activityData.details }
              : agent
          ));
          
          // Check if this is an email built activity - store location with status
          if (activityData.operation === 'Email Processing' || 
              activityData.cardMessage?.includes('✍️ Writing') || 
              activityData.details?.includes('Email built') ||
              activityData.details?.includes('✅ Email built')) {
            console.log('📧 Email built detected!', {
              operation: activityData.operation,
              details: activityData.details,
              hasLocation: !!activityData.location,
              location: activityData.location
            });
            
            if (activityData.location) {
              const coords = geocodeLocation(activityData.location);
              console.log('📍 Geocoded coordinates:', coords);
              if (coords) {
                const agent = agents.find(a => a.agentId === activityData.agentId);
                console.log('📌 Adding email dot for agent:', agent?.name);
                setEmailDots(prev => {
                  const newDot = {
                    id: `${activityData.agentId}_${Date.now()}`,
                    location: {
                      ...coords,
                      city: activityData.location.city,
                      state: activityData.location.state,
                      country: activityData.location.country,
                      companyName: activityData.location.companyName
                    },
                    subject: activityData.details || 'Email queued',
                    to: activityData.targeting?.company || activityData.location.companyName || 'Unknown',
                    agentName: agent?.name || 'Agent',
                    timestamp: Date.now(),
                    status: 'queued' as const
                  };
                  console.log('✅ New email dot:', newDot);
                  return [...prev, newDot];
                });
              }
            } else {
              console.log('⚠️ No location data in activity');
            }
          }
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error);
      }
    });

    return () => eventSource.close();
  }, [agents]);

  // Debug idle agents
  useEffect(() => {
    console.log('All agents:', agents.map(a => ({
      name: a.name,
      status: a.status,
      agentId: a.agentId,
      hasActivity: !!agentActivities[a.agentId],
      isActive: agentActivities[a.agentId]?.isActive,
      shouldBeIdle: !agentActivities[a.agentId]?.isActive || a.status !== 'running'
    })));
    const idleAgents = agents.filter(a => !agentActivities[a.agentId]?.isActive && a.status !== 'running');
    console.log('Idle agents count:', idleAgents.length);
    console.log('Idle agents:', idleAgents.map(a => ({
      name: a.name,
      status: a.status,
      hasActivity: !!agentActivities[a.agentId],
      isActive: agentActivities[a.agentId]?.isActive
    })));
  }, [agents, agentActivities]);

  // Fetch agents list
  const fetchAgents = async () => {
    setLoadingAgents(true);
    try {
      const response = await api.get('/api/auth/agents');
      console.log('Fetched agents:', response.data.agents);
      console.log('Agent activities:', agentActivities);
      const agents = response.data.agents || [];
      console.log('Agents status check:', agents.map((a: any) => ({
        name: a.name,
        status: a.status,
        agentId: a.agentId,
        hasActivity: !!agentActivities[a.agentId],
        isActive: agentActivities[a.agentId]?.isActive
      })));
      setAgents(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Fetch queue emails when agent is selected
  const fetchQueueEmails = async (agentId: string, type: 'queued' | 'sent' | 'replied') => {
    setLoadingQueue(true);
    try {
      let endpoint = '';
      if (type === 'queued') endpoint = `/api/email-queue/queue?agentId=${agentId}`;
      else if (type === 'sent') endpoint = `/api/email-queue/sent?agentId=${agentId}`;
      else if (type === 'replied') endpoint = `/api/email-queue/replied?agentId=${agentId}`;
      
      const response = await api.get(endpoint);
      setQueueEmails(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error fetching queue emails:', error);
      setQueueEmails([]);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleQueueClick = (type: 'queued' | 'sent' | 'replied', label: string) => {
    setSelectedQueue({ agentId: 'all', type, agentName: label });
    setSelectedAgent(null);
    fetchAgents();
  };

  const handleAgentSelect = (agent: any) => {
    if (!selectedQueue) return;
    setSelectedAgent(agent);
    fetchQueueEmails(agent.agentId, selectedQueue.type);
  };

  const handleBackToAgents = () => {
    setSelectedAgent(null);
    setQueueEmails([]);
  };

  const handleApproveEmail = async (emailId: string) => {
    if (!selectedQueue || !selectedAgent) return;
    
    // Optimistic update - remove email immediately
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1),
      emailsSent: prev.emailsSent + 1
    }));
    
    try {
      await api.post(`/api/email-queue/${emailId}/approve`, {
        agentId: selectedAgent.agentId
      });
    } catch (error) {
      console.error('Error approving email:', error);
      // Revert on error
      fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
      const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
      const sentResponse = await api.get('/api/email-queue/sent?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0,
        emailsSent: Array.isArray(sentResponse.data) ? sentResponse.data.length : 0
      }));
    }
  };

  const handleRejectEmail = async (emailId: string) => {
    if (!selectedQueue || !selectedAgent) return;
    
    // Optimistic update - remove email immediately
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1)
    }));
    
    try {
      await api.delete(`/api/email-queue/${emailId}`, {
        data: { agentId: selectedAgent.agentId }
      });
    } catch (error) {
      console.error('Error rejecting email:', error);
      // Revert on error
      fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
      const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0
      }));
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch queued emails
        const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
        const emailsQueued = Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0;

        // Fetch sent emails
        const sentResponse = await api.get('/api/email-queue/sent?agentId=all');
        const emailsSent = Array.isArray(sentResponse.data) ? sentResponse.data.length : 0;

        // Fetch replied/viewed emails
        const repliedResponse = await api.get('/api/email-queue/replied?agentId=all');
        const emailsViewed = Array.isArray(repliedResponse.data) ? repliedResponse.data.length : 0;

        // TODO: Fetch alerts from your alerts API
        const alerts = 0;

        setStats({
          emailsQueued,
          emailsSent,
          emailsViewed,
          alerts
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      }
    };
    
    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Keep rotationRef in sync with rotation state
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, []);

  // Fetch real world data
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => {
        // Convert TopoJSON to GeoJSON
        const countries = feature(data, data.objects.countries);
        setWorldGeoData(countries);
      })
      .catch(() => {
        // Fallback to simplified data if fetch fails
        setWorldGeoData(worldData);
      });
  }, []);

  // Fetch province/state data when country is selected
  useEffect(() => {
    if (!selectedCountry || !isExpanded || !selectedFeature) {
      setProvinceData(null);
      return;
    }

    // Fetch detailed state/province data for the selected country
    // Using a higher resolution dataset
    fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json')
      .then(res => res.json())
      .then(data => {
        if (selectedCountry === 'United States of America' || selectedCountry === 'United States') {
          const states = feature(data, data.objects.states);
          setProvinceData(states);
        } else {
          // For other countries, try to get from world-atlas
          fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
            .then(res => res.json())
            .then(data => {
              const provinces = feature(data, data.objects.countries);
              setProvinceData(provinces);
            })
            .catch(() => setProvinceData(null));
        }
      })
      .catch(() => {
        setProvinceData(null);
      });
  }, [selectedCountry, isExpanded, selectedFeature]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldGeoData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1200;
    canvas.height = 1200;

    const drawGlobe = () => {
      const currentRotation = rotationRef.current;
      
      const projection = geoOrthographic()
        .scale(isExpanded && selectedFeature ? 800 : 500)
        .translate([canvas.width / 2, canvas.height / 2])
        .rotate(currentRotation);

      const path = geoPath(projection, ctx as any);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isExpanded && selectedFeature) {
        // When expanded, use Mercator projection for flat view
        
        // Special handling for USA to center on continental US
        if (selectedCountry === 'United States of America' || selectedCountry === 'United States') {
          // Use Albers USA projection which automatically handles Alaska and Hawaii
          const albersProjection = geoAlbersUsa();
          
          if (albersProjection) {
            albersProjection.fitSize([canvas.width * 0.9, canvas.height * 0.9], selectedFeature);
            
            const translate = albersProjection.translate();
            albersProjection.translate([
              translate[0] + (canvas.width - canvas.width * 0.9) / 2,
              translate[1] + (canvas.height - canvas.height * 0.9) / 2
            ]);
            
            const flatPath = geoPath(albersProjection, ctx as any);
            
            // Draw the country
            ctx.beginPath();
            flatPath(selectedFeature);
            ctx.fillStyle = 'rgba(147, 197, 253, 0.3)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Draw states if available
            if (provinceData) {
              const features = provinceData.features || [];
              features.forEach((feature: any) => {
                ctx.beginPath();
                flatPath(feature);
                ctx.fillStyle = 'rgba(147, 197, 253, 0.2)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 1.5;
                ctx.stroke();
              });
            }
            
            // Draw email dots for US (color-coded by status)
            if (albersProjection && selectedFeature.properties?.name === 'United States') {
              emailDots.forEach(email => {
                const emailCoords = albersProjection([email.location.lng, email.location.lat]);
                if (emailCoords) {
                  // Color based on status: green = meeting, white = sent, yellow/orange = queued
                  const dotColor = email.status === 'meeting' ? '#4ade80' : 
                                  email.status === 'sent' ? '#ffffff' : 
                                  '#fbbf24';
                  
                  ctx.beginPath();
                  ctx.arc(emailCoords[0], emailCoords[1], 4, 0, Math.PI * 2);
                  ctx.fillStyle = dotColor;
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                  ctx.lineWidth = 1;
                  ctx.stroke();
                }
              });
            }
          }
        } else {
          // For other countries, use regular Mercator
          const flatProjection = geoMercator();
          flatProjection.fitSize([canvas.width * 0.9, canvas.height * 0.9], selectedFeature);
          
          const translate = flatProjection.translate();
          flatProjection.translate([
            translate[0] + (canvas.width - canvas.width * 0.9) / 2,
            translate[1] + (canvas.height - canvas.height * 0.9) / 2
          ]);
          
          const flatPath = geoPath(flatProjection, ctx as any);
          
          // Draw the country
          ctx.beginPath();
          flatPath(selectedFeature);
          ctx.fillStyle = 'rgba(147, 197, 253, 0.3)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = 3;
          ctx.stroke();

          // Draw provinces/states if available
          if (provinceData) {
            const features = provinceData.features || [];
            features.forEach((feature: any) => {
              ctx.beginPath();
              flatPath(feature);
              ctx.fillStyle = 'rgba(147, 197, 253, 0.2)';
              ctx.fill();
              ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            });
          }
        }
      } else {
        // Normal globe view
        // Draw ocean/globe background
        ctx.beginPath();
        path({ type: 'Sphere' } as any);
        ctx.fillStyle = 'rgba(100, 150, 255, 0.1)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw graticule (lat/long lines)
        const graticule = geoGraticule();
        ctx.beginPath();
        path(graticule() as any);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Draw countries
        const features = worldGeoData.features || [];
        features.forEach((feature: any) => {
          ctx.beginPath();
          path(feature);
          
          const isSelected = selectedCountry === feature.properties?.name;
          ctx.fillStyle = isSelected ? 'rgba(147, 197, 253, 0.8)' : 'rgba(255, 255, 255, 0.7)';
          ctx.fill();
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          ctx.lineWidth = isSelected ? 2 : 1;
          ctx.stroke();
        });

        // Outer glow
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const gradient = ctx.createRadialGradient(centerX, centerY, 480, centerX, centerY, 510);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
        ctx.beginPath();
        ctx.arc(centerX, centerY, 505, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
      }
    };
    
    const animate = () => {
      drawGlobe();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [worldGeoData, isExpanded, selectedFeature, provinceData, selectedCountry]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHasDragged(false);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - lastMouse.x;
    const deltaY = e.clientY - lastMouse.y;

    // Mark as dragged if there's significant movement
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      setHasDragged(true);
    }

    setRotation(prev => [
      prev[0] + deltaX * 0.25,
      Math.max(-90, Math.min(90, prev[1] - deltaY * 0.25))
    ]);

    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only allow selection if user didn't drag
    if (hasDragged) return;
    
    // Don't handle clicks when already expanded (in country detail view)
    if (isExpanded) return;
    
    const canvas = canvasRef.current;
    if (!canvas || !worldGeoData) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const currentRotation = rotationRef.current;
    const projection = geoOrthographic()
      .scale(500)
      .translate([canvas.width / 2, canvas.height / 2])
      .rotate(currentRotation);

    // Check which country was clicked
    const features = worldGeoData.features || [];
    for (const feature of features) {
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.beginPath();
      const path = geoPath(projection, ctx);
      path(feature);
      
      if (ctx.isPointInPath(x, y)) {
        const countryName = feature.properties?.name || 'Unknown';
        setSelectedCountry(countryName);
        setSelectedFeature(feature);
        setIsExpanded(true);
        return;
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 relative overflow-hidden">
      {/* Top Navigation Buttons - Hidden when country is expanded */}
      {!isExpanded && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex gap-3">
          <button
            onClick={() => { 
              setNavigating(true); 
              setTimeout(() => router.push('/agents-overview'), 0);
            }}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20 flex items-center gap-2"
          >
            Agents
          </button>
          <button
            onClick={() => { 
              setNavigating(true); 
              setTimeout(() => router.push('/profile'), 0);
            }}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20 flex items-center gap-2"
          >
            Profile
          </button>
          <button
            onClick={() => { 
              setNavigating(true); 
              setTimeout(() => router.push('/analytics'), 0);
            }}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20 flex items-center gap-2"
          >
            Analytics
          </button>
          <button
            onClick={() => { 
              setNavigating(true); 
              setTimeout(() => router.push('/settings'), 0);
            }}
            className="px-5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl backdrop-blur-sm transition-all border border-white/20 flex items-center gap-2"
          >
            <Cog6ToothIcon className="w-5 h-5" />
            Settings
          </button>
        </div>
      )}

      {/* Loading Overlay */}
      {navigating && (
        <div className="fixed inset-0 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 z-[9999] flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-2xl font-semibold text-white">Loading...</p>
          </div>
        </div>
      )}

      {/* Meridian Logo */}
      <div className="fixed top-8 left-8 z-50">
        <div className="text-white text-2xl font-bold">
          Meridian
        </div>
      </div>

      {/* User Menu */}
      <div className="fixed top-8 right-8 z-50">
        <div className="[&_button]:!bg-white/20 [&_button]:hover:!bg-white/30 [&_button]:!text-white [&_button]:backdrop-blur-sm [&_button]:rounded-xl [&_div>div>div:nth-child(2)_button]:!text-neutral-900 [&_div>div>div:nth-child(2)_button]:hover:!bg-neutral-50 [&_div>div>div:nth-child(3)_button]:!text-red-600 [&_div>div>div:nth-child(3)_button]:hover:!bg-red-50">
          <UserMenu />
        </div>
      </div>

      {/* Stats Panel - Left Side */}
      <div className="fixed left-8 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-4">
        {/* Email Queue */}
        <button
          onClick={() => handleQueueClick('queued', 'Email Queue')}
          className="bg-white/15 rounded-2xl p-8 border border-white/20 w-[220px] hover:bg-white/20 transition-colors cursor-pointer text-left active:scale-95"
        >
          <div className="text-white/70 text-base mb-2">Email Queue</div>
          <div className="text-6xl font-bold text-white">{stats.emailsQueued}</div>
        </button>

        {/* Emails Sent */}
        <button
          onClick={() => handleQueueClick('sent', 'Sent Emails')}
          className="bg-white/15 rounded-2xl p-8 border border-white/20 w-[220px] hover:bg-white/20 transition-colors cursor-pointer text-left active:scale-95"
        >
          <div className="text-white/70 text-base mb-2">Sent</div>
          <div className="text-6xl font-bold text-white">{stats.emailsSent}</div>
        </button>

        {/* Emails Viewed */}
        <button
          onClick={() => handleQueueClick('replied', 'Viewed Emails')}
          className="bg-white/15 rounded-2xl p-8 border border-white/20 w-[220px] hover:bg-white/20 transition-colors cursor-pointer text-left active:scale-95"
        >
          <div className="text-white/70 text-base mb-2">Viewed</div>
          <div className="text-6xl font-bold text-white">{stats.emailsViewed}</div>
        </button>

        {/* Alerts */}
        <div className="bg-white/15 rounded-2xl p-6 border border-white/20 w-[180px]">
          <div className="text-white/70 text-sm mb-1">Alerts</div>
          <div className="text-4xl font-bold text-white flex items-center gap-2">
            {stats.alerts}
            {stats.alerts > 0 && (
              <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
            )}
          </div>
        </div>
      </div>

      {/* Back Button - Fixed at top center when expanded */}
      {isExpanded && selectedCountry && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-white mb-3">{selectedCountry}</h1>
            <button 
              onClick={() => {
                setIsExpanded(false);
                setSelectedCountry(null);
                setSelectedFeature(null);
                setProvinceData(null);
              }}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl backdrop-blur-sm transition-all"
            >
              ← Back to Globe
            </button>
          </div>
        </div>
      )}

      <div 
        className={`fixed left-1/2 -translate-x-1/2 transition-all duration-700 ease-out ${
          isExpanded ? 'top-1/2 -translate-y-1/2' : 'bottom-0 translate-y-1/2'
        }`}
      >
        <div className="text-center">
          {!isExpanded && (
            <div className="mb-6 animate-fade-in">
              <h1 className="text-4xl font-bold text-white mb-2">Global Reach</h1>
              <p className="text-white/80">Drag to explore • Click a country to zoom in</p>
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            className="cursor-grab active:cursor-grabbing"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={handleCanvasClick}
          />
        </div>
      </div>

      {/* Animated Satellite */}
      {!isExpanded && (
        <div 
          className="fixed right-[32rem] top-1/2 pointer-events-auto cursor-pointer z-50"
          style={{
            transform: `translateY(${satelliteBob - 50}%)`,
            transition: 'transform 0.05s linear'
          }}
          onClick={() => setShowIdleAgents(!showIdleAgents)}
        >
          <div className="relative hover:scale-110 transition-transform">
            {/* ISS Space Station Icon */}
            <svg width="90" height="60" viewBox="0 0 60 40" fill="none" className="drop-shadow-2xl">
              {/* Large Solar Panels - Left */}
              <rect x="2" y="12" width="15" height="16" rx="1" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
              <line x1="2" y1="16" x2="17" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
              <line x1="2" y1="20" x2="17" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
              <line x1="2" y1="24" x2="17" y2="24" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
              
              {/* Large Solar Panels - Right */}
              <rect x="43" y="12" width="15" height="16" rx="1" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5"/>
              <line x1="43" y1="16" x2="58" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
              <line x1="43" y1="20" x2="58" y2="20" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
              <line x1="43" y1="24" x2="58" y2="24" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
              
              {/* Main Truss */}
              <rect x="18" y="18" width="24" height="4" rx="1" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
              
              {/* Modules */}
              <ellipse cx="25" cy="20" rx="4" ry="3" fill="rgba(255,255,255,0.4)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
              <ellipse cx="30" cy="20" rx="5" ry="4" fill="rgba(255,255,255,0.45)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
              <ellipse cx="35" cy="20" rx="4" ry="3" fill="rgba(255,255,255,0.4)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5"/>
              
              {/* Small Solar Arrays */}
              <rect x="27" y="8" width="6" height="8" rx="0.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
              <line x1="27" y1="10" x2="33" y2="10" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
              <line x1="27" y1="12" x2="33" y2="12" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
              <line x1="27" y1="14" x2="33" y2="14" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
              
              {/* Radiators */}
              <rect x="22" y="24" width="3" height="8" rx="0.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
              <rect x="35" y="24" width="3" height="8" rx="0.5" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" strokeWidth="1"/>
            </svg>
            
            {/* Idle Agent Badge */}
            {agents.filter(a => !agentActivities[a.agentId]?.isActive && a.status !== 'running').length > 0 && (
              <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs rounded-full min-w-6 h-6 px-2 flex items-center justify-center font-bold shadow-lg">
                {agents.filter(a => !agentActivities[a.agentId]?.isActive && a.status !== 'running').length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Dots on Globe (color-coded by status) */}
      {!isExpanded && emailDots.map((email) => {
        // Project email location to screen coordinates
        const projection = geoOrthographic()
          .scale(500)
          .rotate(rotation)
          .translate([600, 600]);
        
        const coords = projection([email.location.lng, email.location.lat]);
        if (!coords) return null;
        
        // Calculate screen position (same as agent positioning)
        const canvasCenterX = window.innerWidth / 2;
        const canvasCenterY = window.innerHeight;
        const pointX = canvasCenterX + (coords[0] - 600);
        const pointY = canvasCenterY + (coords[1] - 600);
        
        // Color based on status: green = meeting, white = sent, yellow/orange = queued
        const dotColor = email.status === 'meeting' ? '#4ade80' : 
                        email.status === 'sent' ? '#ffffff' : 
                        '#fbbf24'; // yellow/orange for queued
        
        return (
          <div key={email.id} className="fixed pointer-events-none" style={{ zIndex: 44 }}>
            <svg className="fixed inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              <circle
                cx={pointX}
                cy={pointY}
                r="3"
                fill={dotColor}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="1"
                opacity="0.8"
                className="animate-pulse"
              />
            </svg>
          </div>
        );
      })}

      {/* Active Agents on Globe */}
      {!isExpanded && agents.map((agent, index) => {
        // Show agents that are running OR have activity
        const activity = agentActivities[agent.agentId];
        const isActive = agent.status === 'running' || activity?.isActive;
        if (!isActive) return null;
        
        // Get real location from SSE activity data, or fall back to random US position
        let lat, lng;
        if (activity?.location) {
          const coords = geocodeLocation(activity.location);
          if (coords) {
            lat = coords.lat;
            lng = coords.lng;
          } else {
            // Fallback to random US position
            const seed = index * 137.508;
            lat = 25 + ((Math.abs(Math.sin(seed)) * 24));
            lng = -125 + ((Math.abs(Math.cos(seed)) * 60));
          }
        } else {
          // Fallback to random US position
          const seed = index * 137.508;
          lat = 25 + ((Math.abs(Math.sin(seed)) * 24));
          lng = -125 + ((Math.abs(Math.cos(seed)) * 60));
        }
        
        // Project to screen coordinates using same projection as canvas
        const projection = geoOrthographic()
          .scale(500)
          .rotate(rotation)
          .translate([600, 600]); // Canvas is 1200x1200, center at 600,600
        
        const coords = projection([lng, lat]);
        if (!coords) return null;
        
        // Canvas position: centered horizontally, bottom-0 + translate-y-1/2
        // This means the canvas bottom edge is at 50% viewport height
        const canvasWidth = 1200;
        const canvasHeight = 1200;
        const canvasCenterX = window.innerWidth / 2;
        const canvasCenterY = window.innerHeight; // Bottom edge
        
        // Point position relative to canvas center (600, 600)
        const pointX = canvasCenterX + (coords[0] - 600);
        const pointY = canvasCenterY + (coords[1] - 600);
        
        // Callout line extends out from the point
        const calloutAngle = (index * 60) % 360; // Different angles for each agent
        const lineLength = 60;
        const horizontalLength = 80;
        const slantEndX = pointX + Math.cos(calloutAngle * Math.PI / 180) * lineLength;
        const slantEndY = pointY + Math.sin(calloutAngle * Math.PI / 180) * lineLength;
        const horizontalEndX = slantEndX + horizontalLength;
        const horizontalEndY = slantEndY;
        
        // Get current keywords from activity or agent settings
        const industries = agent.settings?.companyCriteria?.companyIndustries || [];
        const positions = agent.settings?.contactCriteria?.targetPositions || [];
        const keywordText = industries.length > 0 
          ? industries.slice(0, 2).join(', ') 
          : positions.length > 0 
          ? positions.slice(0, 2).join(', ')
          : 'searching...';
        
        return (
          <div 
            key={agent.agentId} 
            className="fixed pointer-events-none animate-fade-in" 
            style={{ 
              zIndex: 45,
              animation: 'fadeIn 0.5s ease-out'
            }}
          >
            {/* Callout line */}
            <svg className="fixed inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
              {/* Slant line from point to callout */}
              <line
                x1={pointX}
                y1={pointY}
                x2={slantEndX}
                y2={slantEndY}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                className="animate-draw-line"
              />
              {/* Horizontal line */}
              <line
                x1={slantEndX}
                y1={slantEndY}
                x2={horizontalEndX}
                y2={horizontalEndY}
                stroke="rgba(255,255,255,0.5)"
                strokeWidth="2"
                className="animate-draw-line"
                style={{ animationDelay: '0.2s' }}
              />
              {/* Point marker on globe */}
              <circle
                cx={pointX}
                cy={pointY}
                r="4"
                fill="rgb(74, 222, 128)"
                stroke="white"
                strokeWidth="2"
                className="animate-scale-in"
              />
            </svg>
            
            {/* Agent info at end of horizontal line */}
            <div
              className="fixed pointer-events-auto transition-all duration-300"
              style={{
                left: `${horizontalEndX}px`,
                top: `${horizontalEndY}px`,
                transform: 'translateY(-50%)'
              }}
            >
              {/* Agent name and search keywords above */}
              <div className="text-white/90 text-xs font-medium mb-1 whitespace-nowrap">
                <div className="font-bold">{agent.name}</div>
                <div className="text-white/70 text-[10px]">{keywordText}</div>
              </div>
              
              {/* Avatar and Stop button */}
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={() => router.push(`/agents?agent=${agent.agentId}&returnTo=/animations-demo`)}
                    className="block"
                  >
                    <img 
                      src={agent.avatar || agent.personality?.avatar} 
                      alt={agent.name}
                      className="w-10 h-10 rounded-full border-2 border-green-400 shadow-lg transition-transform hover:scale-110 cursor-pointer"
                    />
                  </button>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute left-12 top-0 bg-black/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 min-w-[200px]">
                    <div className="font-bold mb-1">
                      {activity?.location?.companyName || 'Targeting:'}
                    </div>
                    <div className="text-white/80 text-[10px] space-y-0.5">
                      {activity?.location && (
                        <>
                          {activity.location.city && <div>📍 {activity.location.city}, {activity.location.state || activity.location.country}</div>}
                          {activity.targeting?.industry && <div>🏢 {activity.targeting.industry}</div>}
                          {activity.targeting?.position && <div>👤 {activity.targeting.position}</div>}
                        </>
                      )}
                      {!activity?.location && (
                        <>
                          {agent.settings?.companyCriteria?.companyIndustries && agent.settings.companyCriteria.companyIndustries.length > 0 && (
                            <div>Industries: {agent.settings.companyCriteria.companyIndustries.slice(0, 3).join(', ')}</div>
                          )}
                          {agent.settings?.contactCriteria?.targetPositions && agent.settings.contactCriteria.targetPositions.length > 0 && (
                            <div>Positions: {agent.settings.contactCriteria.targetPositions.slice(0, 3).join(', ')}</div>
                          )}
                          {agent.settings?.companyCriteria?.companySizeMin && agent.settings?.companyCriteria?.companySizeMax && (
                            <div>Size: {agent.settings.companyCriteria.companySizeMin}-{agent.settings.companyCriteria.companySizeMax} emp</div>
                          )}
                        </>
                      )}
                      {(!activity?.location && (!agent.settings?.companyCriteria?.companyIndustries || agent.settings.companyCriteria.companyIndustries.length === 0) && 
                       (!agent.settings?.contactCriteria?.targetPositions || agent.settings.contactCriteria.targetPositions.length === 0)) && (
                        <div>General lead search</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={async () => {
                    // Optimistic update - hide agent immediately
                    setAgentActivities(prev => ({
                      ...prev,
                      [agent.agentId]: { ...prev[agent.agentId], isActive: false }
                    }));
                    setAgents(prev => prev.map(a => 
                      a.agentId === agent.agentId 
                        ? { ...a, status: 'idle' }
                        : a
                    ));
                    
                    try {
                      await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                    } catch (error) {
                      console.error('Error stopping agent:', error);
                      // Revert on error
                      fetchAgents();
                    }
                  }}
                  className="px-2 py-1 bg-red-500/80 hover:bg-red-500 active:bg-red-600 active:scale-95 text-white text-xs rounded transition-all"
                >
                  Stop
                </button>
              </div>
              
              {/* Activity info below */}
              <div className="text-white/70 text-xs mt-1 whitespace-nowrap max-w-[200px] truncate">
                {activity?.status || agent.currentActivity || 'Running...'}
              </div>
            </div>
          </div>
        );
      })}

      {/* Email Dots on Expanded Country View (color-coded by status) */}
      {isExpanded && selectedFeature && emailDots.map((email) => {
        // Calculate projection based on country
        let emailCoords;
        
        if (selectedFeature.properties?.name === 'United States') {
          const albersProjection = geoAlbersUsa()
            .scale(1)
            .translate([0, 0]);
          
          const canvas = canvasRef.current;
          if (canvas) {
            albersProjection.fitSize([canvas.width * 0.9, canvas.height * 0.9], selectedFeature);
            const translate = albersProjection.translate();
            albersProjection.translate([
              translate[0] + (canvas.width - canvas.width * 0.9) / 2,
              translate[1] + (canvas.height - canvas.height * 0.9) / 2
            ]);
            emailCoords = albersProjection([email.location.lng, email.location.lat]);
          }
        } else {
          const flatProjection = geoMercator();
          const canvas = canvasRef.current;
          if (canvas) {
            flatProjection.fitSize([canvas.width * 0.9, canvas.height * 0.9], selectedFeature);
            const translate = flatProjection.translate();
            flatProjection.translate([
              translate[0] + (canvas.width - canvas.width * 0.9) / 2,
              translate[1] + (canvas.height - canvas.height * 0.9) / 2
            ]);
            emailCoords = flatProjection([email.location.lng, email.location.lat]);
          }
        }
        
        if (!emailCoords) return null;
        
        // Calculate screen position
        const canvasCenterX = window.innerWidth / 2;
        const canvasCenterY = window.innerHeight;
        const pointX = canvasCenterX + (emailCoords[0] - 600);
        const pointY = canvasCenterY + (emailCoords[1] - 600);
        
        // Color and label based on status
        const dotColor = email.status === 'meeting' ? 'bg-green-400' : 
                        email.status === 'sent' ? 'bg-white' : 
                        'bg-yellow-400'; // yellow for queued
        const statusLabel = email.status === 'meeting' ? '✅ Meeting Booked' : 
                           email.status === 'sent' ? '📧 Email Sent' : 
                           '⏳ Queued';
        const statusColor = email.status === 'meeting' ? 'text-green-400' : 
                           email.status === 'sent' ? 'text-white' : 
                           'text-yellow-400';
        
        return (
          <div 
            key={email.id} 
            className="fixed group" 
            style={{ 
              left: `${pointX}px`, 
              top: `${pointY}px`,
              transform: 'translate(-50%, -50%)',
              zIndex: 100 // Higher z-index to be above canvas
            }}
          >
            {/* Colored dot based on status */}
            <div className={`w-4 h-4 ${dotColor} rounded-full border-2 border-white/70 cursor-pointer hover:scale-150 transition-transform shadow-xl pointer-events-auto`} />
            
            {/* Tooltip on hover */}
            <div className="absolute left-6 top-0 bg-black/95 backdrop-blur-sm text-white text-xs px-4 py-3 rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[110] min-w-[250px] shadow-2xl border border-white/20">
              <div className="font-bold text-sm mb-2">{email.location.companyName || 'Email Activity'}</div>
              <div className="space-y-1 text-white/80">
                <div className={`font-semibold ${statusColor}`}>{statusLabel}</div>
                <div>📧 To: {email.to}</div>
                <div>👤 Agent: {email.agentName}</div>
                {email.location.city && <div>📍 {email.location.city}, {email.location.state || email.location.country}</div>}
                <div className="text-[10px] text-white/60 mt-2">
                  {new Date(email.timestamp).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Idle Agents Modal */}
      {showIdleAgents && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[70vh] overflow-hidden flex flex-col border border-white/20">
            <div className="p-6 border-b border-white/20 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Idle Agents</h2>
              <button
                onClick={() => setShowIdleAgents(false)}
                className="text-white/70 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6" style={{transform: 'translateZ(0)', willChange: 'scroll-position'}}>
              {agents.filter(a => !agentActivities[a.agentId]?.isActive && a.status !== 'running').length === 0 ? (
                <div className="text-center py-12 text-white/70">
                  All agents are currently active
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {agents.filter(a => !agentActivities[a.agentId]?.isActive && a.status !== 'running').map(agent => (
                    <div
                      key={agent.agentId}
                      className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 hover:border-white/40 transition-all"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        {(agent.avatar || agent.personality?.avatar) && (
                          <img 
                            src={agent.avatar || agent.personality?.avatar} 
                            alt={agent.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-bold text-white">{agent.name}</div>
                          <div className="text-sm text-white/70">{agent.personality?.name || 'Agent'}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            
                            // Optimistic update - update UI immediately
                            const isCurrentlyRunning = agent.status === 'running';
                            const updatedStatus = isCurrentlyRunning ? 'idle' : 'running';
                            
                            // Update agents list immediately
                            setAgents(prev => prev.map(a => 
                              a.agentId === agent.agentId 
                                ? { ...a, status: updatedStatus }
                                : a
                            ));
                            
                            // Update activity state
                            if (isCurrentlyRunning) {
                              setAgentActivities(prev => ({
                                ...prev,
                                [agent.agentId]: { ...prev[agent.agentId], isActive: false }
                              }));
                            } else {
                              setAgentActivities(prev => ({
                                ...prev,
                                [agent.agentId]: { isActive: true, status: 'Starting...', timestamp: Date.now() }
                              }));
                            }
                            
                            try {
                              if (isCurrentlyRunning) {
                                await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                              } else {
                                await api.post('/api/lead-agent/start', { agentId: agent.agentId });
                              }
                            } catch (error) {
                              console.error('Error updating agent status:', error);
                              // Revert on error
                              fetchAgents();
                            }
                          }}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 ${
                            agent.status === 'running'
                              ? 'bg-red-500/20 hover:bg-red-500/30 active:bg-red-500/40 text-red-300 border border-red-500/40'
                              : 'bg-green-500/20 hover:bg-green-500/30 active:bg-green-500/40 text-green-300 border border-green-500/40'
                          }`}
                        >
                          {agent.status === 'running' ? 'Stop' : 'Start'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/agents?agent=${agent.agentId}&returnTo=/animations-demo`);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/20 hover:bg-blue-500/30 active:bg-blue-500/40 active:scale-95 text-blue-300 border border-blue-500/40 transition-all"
                        >
                          View Agent
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Queue Modal */}
      {selectedQueue && !navigating && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-indigo-950 via-purple-950 to-pink-950 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-white/20">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedAgent && (
                  <button
                    onClick={handleBackToAgents}
                    className="text-white/70 hover:text-white text-xl"
                  >
                    ←
                  </button>
                )}
                <h2 className="text-2xl font-bold text-white">
                  {selectedAgent ? selectedAgent.name : selectedQueue.agentName}
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedQueue(null);
                  setSelectedAgent(null);
                  setQueueEmails([]);
                }}
                className="text-white/70 hover:text-white text-2xl"
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6" style={{transform: 'translateZ(0)', willChange: 'scroll-position'}}>
              {!selectedAgent ? (
                // Show agents list
                loadingAgents ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">Loading agents...</div>
                  </div>
                ) : agents.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">No agents found</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {agents.map((agent) => {
                      const avatarSrc = agent.avatar || agent.personality?.avatar;
                      return (
                        <button
                          key={agent.agentId}
                          onClick={() => handleAgentSelect(agent)}
                          className="bg-white/15 rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-colors text-left"
                        >
                          <div className="flex items-center gap-3 mb-2">
                            {avatarSrc && (
                              <img 
                                src={avatarSrc} 
                                alt={agent.name}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  console.log('Failed to load avatar:', avatarSrc);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <div className="font-bold text-white text-lg">{agent.name}</div>
                          </div>
                          <div className="text-sm text-white/70">
                            {agent.personality?.name || 'Agent'}
                          </div>
                          <div className="mt-3 text-xs text-white/50">
                            Click to view {selectedQueue?.type} emails
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                // Show emails for selected agent
                loadingQueue ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">Loading emails...</div>
                  </div>
                ) : queueEmails.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">No emails found</div>
                  </div>
                ) : (
                  <div className="space-y-2 will-change-transform">
                    {queueEmails.map((email) => {
                      const emailId = email._id || email.id;
                      const isExpanded = expandedEmailId === emailId;
                      const isEditing = editingEmail?.id === emailId;
                      
                      return (
                        <div key={emailId} className="bg-white/15 border border-white/20 rounded-xl overflow-hidden">
                          {/* Email Title Row - Always Visible */}
                          <button
                            onClick={() => {
                              if (isExpanded) {
                                setExpandedEmailId(null);
                                setEditingEmail(null);
                              } else {
                                setExpandedEmailId(emailId);
                              }
                            }}
                            className="w-full p-4 hover:bg-white/5 text-left flex items-center justify-between group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-white truncate">{email.subject || 'No Subject'}</div>
                              <div className="text-sm text-white/60 truncate">To: {email.to}</div>
                            </div>
                            <div className="flex items-center gap-3 ml-4">
                              {email.scheduledFor && (
                                <div className="text-xs text-white/50">
                                  {new Date(email.scheduledFor).toLocaleDateString()}
                                </div>
                              )}
                              <svg 
                                className={`w-5 h-5 text-white/70 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                                fill="none" 
                                viewBox="0 0 24 24" 
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          {/* Expanded Email Content */}
                          {isExpanded && (
                            <div className="border-t border-white/20 p-4 space-y-4">
                              {isEditing ? (
                                // Edit Mode
                                <>
                                  <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">To</label>
                                    <input
                                      type="text"
                                      value={editingEmail?.to || ''}
                                      onChange={(e) => editingEmail && setEditingEmail({...editingEmail, to: e.target.value})}
                                      className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                      placeholder="recipient@example.com"
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm font-medium text-white/70 mb-2">CC (optional)</label>
                                      <input
                                        type="text"
                                        value={editingEmail?.cc || ''}
                                        onChange={(e) => editingEmail && setEditingEmail({...editingEmail, cc: e.target.value})}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="cc@example.com"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-white/70 mb-2">BCC (optional)</label>
                                      <input
                                        type="text"
                                        value={editingEmail?.bcc || ''}
                                        onChange={(e) => editingEmail && setEditingEmail({...editingEmail, bcc: e.target.value})}
                                        className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="bcc@example.com"
                                      />
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">Subject</label>
                                    <input
                                      type="text"
                                      value={editingEmail?.subject || ''}
                                      onChange={(e) => editingEmail && setEditingEmail({...editingEmail, subject: e.target.value})}
                                      className="w-full px-4 py-2 bg-white/10 border border-white/30 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-white/70 mb-2">Body</label>
                                    <textarea
                                      value={editingEmail?.body || ''}
                                      onChange={(e) => editingEmail && setEditingEmail({...editingEmail, body: e.target.value})}
                                      rows={12}
                                      className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingEmail(null)}
                                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!editingEmail) return;
                                        try {
                                          // Include agentId from email object or selectedQueue
                                          const agentId = email.agentId || selectedQueue?.agentId;
                                          await api.put(`/api/email-queue/${emailId}`, {
                                            to: editingEmail.to,
                                            cc: editingEmail.cc,
                                            bcc: editingEmail.bcc,
                                            subject: editingEmail.subject,
                                            body: editingEmail.body,
                                            agentId: agentId,
                                            // Update emailData nested object for approval process
                                            emailData: {
                                              ...(email.emailData || {}),
                                              subject: editingEmail.subject,
                                              body: editingEmail.body,
                                              cc: editingEmail.cc,
                                              bcc: editingEmail.bcc,
                                              finalRecipient: editingEmail.to,
                                              finalSubject: editingEmail.subject,
                                              finalBody: editingEmail.body
                                            }
                                          });
                                          setQueueEmails(prev => prev.map(e => 
                                            (e._id || e.id) === emailId 
                                              ? {...e, to: editingEmail.to, cc: editingEmail.cc, bcc: editingEmail.bcc, subject: editingEmail.subject, body: editingEmail.body}
                                              : e
                                          ));
                                          setEditingEmail(null);
                                        } catch (error) {
                                          console.error('Error saving email:', error);
                                          alert('Failed to save email changes');
                                        }
                                      }}
                                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                                    >
                                      Save Changes
                                    </button>
                                  </div>
                                </>
                              ) : (
                                // View Mode
                                <>
                                  <div className="space-y-2 mb-4">
                                    <div className="flex items-start gap-2 text-sm">
                                      <span className="font-semibold text-white/70 min-w-[60px]">To:</span>
                                      <span className="text-white">{email.to}</span>
                                    </div>
                                    {email.cc && (
                                      <div className="flex items-start gap-2 text-sm">
                                        <span className="font-semibold text-white/70 min-w-[60px]">CC:</span>
                                        <span className="text-white/80">{email.cc}</span>
                                      </div>
                                    )}
                                    {email.bcc && (
                                      <div className="flex items-start gap-2 text-sm">
                                        <span className="font-semibold text-white/70 min-w-[60px]">BCC:</span>
                                        <span className="text-white/80">{email.bcc}</span>
                                      </div>
                                    )}
                                    <div className="flex items-start gap-2 text-sm">
                                      <span className="font-semibold text-white/70 min-w-[60px]">Subject:</span>
                                      <span className="text-white">{email.subject || 'No Subject'}</span>
                                    </div>
                                  </div>
                                  <div className="bg-white/5 rounded-lg p-4">
                                    <div className="text-sm text-white/90 whitespace-pre-wrap font-mono leading-relaxed">
                                      {email.body}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    {email.scheduledFor && (
                                      <div className="text-xs text-white/50">
                                        Scheduled: {new Date(email.scheduledFor).toLocaleString()}
                                      </div>
                                    )}
                                    <div className="flex gap-2 ml-auto">
                                      <button
                                        onClick={() => setEditingEmail({
                                          id: emailId, 
                                          to: email.to,
                                          cc: email.cc || '',
                                          bcc: email.bcc || '',
                                          subject: email.subject, 
                                          body: email.body
                                        })}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95 text-white rounded-lg text-sm transition-all duration-150"
                                      >
                                        Edit
                                      </button>
                                      {selectedQueue.type === 'queued' && (
                                        <>
                                          <button
                                            onClick={() => handleApproveEmail(emailId)}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 active:bg-green-800 active:scale-95 text-white rounded-lg text-sm transition-all duration-150"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => handleRejectEmail(emailId)}
                                            className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 active:scale-95 text-white rounded-lg text-sm transition-all duration-150"
                                          >
                                            Reject
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.8);
          }
        }
        
        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.6s ease-out;
        }
        
        .animate-scale-in {
          animation: scaleIn 0.4s ease-out forwards;
          transform-origin: center;
        }
      `}</style>
    </div>
  );
}
