'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UsersIcon, ComputerDesktopIcon, ChartPieIcon, Cog6ToothIcon, BookOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import UserMenu from '@/components/UserMenu';
import HelpChat from '@/components/HelpChat';
import api from '@/lib/api';
import { geoOrthographic, geoPath, geoGraticule, geoMercator, geoAlbersUsa } from 'd3-geo';
import { feature } from 'topojson-client';
import dynamic from 'next/dynamic';

// Dynamically import InfoDashboard
const InfoDashboard = dynamic(() => import('@/components/InfoDashboard'), {
  ssr: false
});

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
  const [rotation, setRotation] = useState<[number, number]>([95, -15]);
  const rotationRef = useRef<[number, number]>([95, -15]);
  const [targetRotation, setTargetRotation] = useState<[number, number] | null>(null);
  const [isAnimatingToAgent, setIsAnimatingToAgent] = useState(false);
  const animationRef = useRef<number | undefined>(undefined);
  const [worldGeoData, setWorldGeoData] = useState<any>(null);

  // Globe view toggle
  const [showGlobe, setShowGlobe] = useState(false);
  const [globeLoading, setGlobeLoading] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  // Handle globe toggle with animation
  const handleGlobeToggle = (show: boolean) => {
    if (!show && showGlobe) {
      // Turning off - animate out first
      setIsAnimatingOut(true);
      setTimeout(() => {
        setShowGlobe(false);
        setIsAnimatingOut(false);
      }, 500); // Match transition duration
    } else {
      setShowGlobe(show);
    }
  };

  // When globe is turned on, start loading sequence (useLayoutEffect runs before paint)
  useLayoutEffect(() => {
    if (showGlobe) {
      setIsAnimatingOut(false);
      setGlobeLoading(true);
      const timer = setTimeout(() => {
        setGlobeLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setGlobeLoading(false);
    }
  }, [showGlobe]);

  // Real stats data
  const [stats, setStats] = useState({
    emailsQueued: 0,
    emailsSent: 0,
    emailsViewed: 0,
    alerts: 0
  });

  // Toast notification state
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

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
  const [currentEmailPage, setCurrentEmailPage] = useState(1);
  const EMAILS_PER_PAGE = 20;
  
  // Modal drag and resize states
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ width: 896, height: 600 }); // max-w-4xl = 896px
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const rafRef = useRef<number | undefined>(undefined);

  // Satellite and agent positioning
  const [showIdleAgents, setShowIdleAgents] = useState(false);
  const [satelliteBob, setSatelliteBob] = useState(0);
  const [agentActivities, setAgentActivities] = useState<{[agentId: string]: any}>({});
  const [emailActivity, setEmailActivity] = useState<any[]>([]);
  const [activityFilter, setActivityFilter] = useState<'all' | 'opened' | 'sent' | 'bounced'>('all');
  
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
  
  // Canvas size state to prevent hydration mismatch
  const [canvasSize, setCanvasSize] = useState(1200); // Default size for SSR
  const [isMounted, setIsMounted] = useState(false);

  // Track mount to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track mount to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Mount effect to prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  // Set canvas size on mount to prevent hydration mismatch
  useEffect(() => {
    const updateCanvasSize = () => {
      if (typeof window !== 'undefined') {
        const width = window.innerWidth;
        let size;
        if (width < 640) {
          // Mobile: Use 90% of screen width or max 450px
          size = Math.min(width * 0.9, 450);
        } else if (width < 768) {
          // Small tablet
          size = 500;
        } else if (width < 1024) {
          // Tablet
          size = 600;
        } else if (width < 1280) {
          // Small laptop (mom's Mac) - scale down proportionally
          size = Math.min(700, width * 0.6);
        } else if (width < 1536) {
          // Medium desktop
          size = Math.min(800, width * 0.55);
        } else {
          // Large desktop
          size = Math.min(950, width * 0.5);
        }
        setCanvasSize(size);
        setIsMounted(true);
      }
    };
    
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

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
    if (!isMounted) return;
    
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
              ? { ...agent, currentActivity: activityData.cardMessage || activityData.details, status: 'running' }
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
  }, [agents, isMounted]);

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
  const fetchAgents = async (queueType?: 'queued' | 'sent' | 'replied') => {
    setLoadingAgents(true);
    try {
      const response = await api.get('/api/auth/agents');
      console.log('Fetched agents:', response.data.agents);
      console.log('Agent activities:', agentActivities);
      let agents = response.data.agents || [];
      console.log('Agents status check:', agents.map((a: any) => ({
        name: a.name,
        status: a.status,
        agentId: a.agentId,
        hasActivity: !!agentActivities[a.agentId],
        isActive: agentActivities[a.agentId]?.isActive,
        useGmail: a.settings?.emailSettings?.useGmail,
        hasEmailSettings: !!a.settings?.emailSettings
      })));
      
      // Check for orphaned emails and add special agent if any exist
      if (queueType === 'queued') {
        try {
          const orphanedRes = await api.get('/api/email-queue/queue?agentId=orphan');
          const orphanedEmails = Array.isArray(orphanedRes.data) ? orphanedRes.data : (orphanedRes.data.emails || []);
          
          if (orphanedEmails.length > 0) {
            // Add orphaned emails as a special agent at the top
            agents = [{
              agentId: 'orphan',
              name: 'Orphaned Emails',
              status: 'orphaned',
              isOrphaned: true
            }, ...agents];
          }
        } catch (error) {
          console.error('Error fetching orphaned emails:', error);
        }
      }
      
      setAgents(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
    }
  };

  // Fetch email activity from analytics API
  const fetchEmailActivity = async () => {
    try {
      const response = await api.get('/api/analytics/emails');
      if (response.data.success) {
        const emails = response.data.data || [];
        // Sort by sentAt timestamp descending (most recent first)
        const sortedEmails = emails.sort((a: any, b: any) => 
          new Date(b.sentAt || b.timestamp).getTime() - new Date(a.sentAt || a.timestamp).getTime()
        );
        setEmailActivity(sortedEmails.slice(0, 50)); // Keep last 50 emails
      }
    } catch (err) {
      console.error('Error fetching email activity:', err);
    }
  };

  // Fetch queue emails when agent is selected
  const fetchQueueEmails = async (agentId: string, type: 'queued' | 'sent' | 'replied') => {
    setLoadingQueue(true);
    setCurrentEmailPage(1); // Reset to first page when fetching new emails
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

  // Modal drag handlers
  const handleModalMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.resize-handle')) return;
    setIsDraggingModal(true);
    setDragStart({ x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y });
  };

  const handleModalMouseMove = (e: MouseEvent) => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    
    rafRef.current = requestAnimationFrame(() => {
      if (isDraggingModal) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;
        
        // Constrain to viewport boundaries (8px padding)
        const maxX = window.innerWidth - modalSize.width - 8;
        const maxY = window.innerHeight - modalSize.height - 8;
        
        setModalPosition({
          x: Math.max(8, Math.min(maxX, newX)),
          y: Math.max(8, Math.min(maxY, newY))
        });
      }
      if (isResizing && resizeDirection) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;
        
        // Resize based on direction - only change dimensions in the direction being dragged
        if (resizeDirection.includes('e')) {
          // Right edge: only increase width to the right
          const maxWidth = window.innerWidth - resizeStart.posX - 8;
          newWidth = Math.max(400, Math.min(maxWidth, resizeStart.width + deltaX));
        }
        if (resizeDirection.includes('w')) {
          // Left edge: increase width to the left by moving position
          const maxLeftMove = resizeStart.posX - 8;
          const actualDelta = Math.max(-maxLeftMove, deltaX);
          newWidth = Math.max(400, Math.min(window.innerWidth - 16, resizeStart.width - actualDelta));
          newX = resizeStart.posX + resizeStart.width - newWidth;
        }
        if (resizeDirection.includes('s')) {
          // Bottom edge: only increase height downward
          const maxHeight = window.innerHeight - resizeStart.posY - 8;
          newHeight = Math.max(300, Math.min(maxHeight, resizeStart.height + deltaY));
        }
        if (resizeDirection.includes('n')) {
          // Top edge: increase height upward by moving position
          const maxUpMove = resizeStart.posY - 8;
          const actualDelta = Math.max(-maxUpMove, deltaY);
          newHeight = Math.max(300, Math.min(window.innerHeight - 16, resizeStart.height - actualDelta));
          newY = resizeStart.posY + resizeStart.height - newHeight;
        }
        
        setModalSize({ width: newWidth, height: newHeight });
        setModalPosition({ x: newX, y: newY });
      }
    });
  };

  const handleModalMouseUp = () => {
    setIsDraggingModal(false);
    setIsResizing(false);
  };

  const handleResizeMouseDown = (direction: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: modalSize.width,
      height: modalSize.height,
      posX: modalPosition.x,
      posY: modalPosition.y
    });
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDraggingModal || isResizing) {
      window.addEventListener('mousemove', handleModalMouseMove);
      window.addEventListener('mouseup', handleModalMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleModalMouseMove);
        window.removeEventListener('mouseup', handleModalMouseUp);
      };
    }
  }, [isDraggingModal, isResizing, dragStart, resizeStart, modalPosition, modalSize, resizeDirection]);

  const handleQueueClick = (type: 'queued' | 'sent' | 'replied', label: string) => {
    setSelectedQueue({ agentId: 'all', type, agentName: label });
    setSelectedAgent(null);
    // Reset modal position and size when opening - center it on screen
    const centerX = (window.innerWidth - 896) / 2;
    const centerY = (window.innerHeight - 600) / 2;
    setModalPosition({ x: Math.max(8, centerX), y: Math.max(8, centerY) });
    setModalSize({ width: 896, height: 600 });
    fetchAgents(type);
  };

  const handleAgentSelect = (agent: any) => {
    if (!selectedQueue) return;
    setLoadingQueue(true); // Set loading immediately
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
      // For orphaned emails, use the original agent ID from the email or 'orphan'
      const agentIdToUse = selectedAgent.agentId === 'orphan' ? 'orphan' : selectedAgent.agentId;
      
      await api.post(`/api/email-queue/${emailId}/approve`, {
        agentId: agentIdToUse,
        isOrphaned: selectedAgent.agentId === 'orphan'
      });
      showToast('Email sent successfully! 🚀', 'success');
    } catch (error) {
      console.error('Error approving email:', error);
      showToast('Failed to send email', 'error');
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
    fetchEmailActivity();
    
    // Poll for email activity every 15 seconds
    const interval = setInterval(() => {
      fetchEmailActivity();
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  // Refetch agents when page becomes visible (when user navigates back)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refetching agents...');
        fetchAgents();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Fetch real world data
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then(res => res.json())
      .then(data => {
        // Convert TopoJSON to GeoJSON
        const countries = feature(data, data.objects.countries);
        setWorldGeoData(countries);
        // Globe is ready
        setTimeout(() => setGlobeLoading(false), 100);
      })
      .catch(() => {
        // Fallback to simplified data if fetch fails
        setWorldGeoData(worldData);
        setTimeout(() => setGlobeLoading(false), 100);
      });
  }, []);



  useEffect(() => {
    if (!showGlobe || globeLoading) return; // Don't render during loading
    
    const canvas = canvasRef.current;
    if (!canvas || !worldGeoData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use state-based canvas size to prevent hydration issues
    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const drawGlobe = () => {
      const currentRotation = rotationRef.current;
      
      // Adjust scale based on canvas size - larger globe
      const baseScale = canvasSize / 2.0; // Increased from 2.4 for larger globe
      const projection = geoOrthographic()
        .scale(baseScale)
        .translate([canvas.width / 2, canvas.height / 2])
        .rotate(currentRotation);

      const path = geoPath(projection, ctx as any);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

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
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
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
  }, [worldGeoData, canvasSize, showGlobe, globeLoading]);

// Auto-rotation effect - stops when agents are running
  useEffect(() => {
    if (isAnimatingToAgent) return;
    
    // Get all running agents
    const runningAgents = agents.filter(a => a.status === 'running' || agentActivities[a.agentId]?.isActive);
    
    // If agents are running, stop rotation
    if (runningAgents.length > 0) return;
    
    const interval = setInterval(() => {
      setRotation(prev => [prev[0] + 0.1, prev[1]]);  
    }, 50);
    
    return () => clearInterval(interval);
  }, [isAnimatingToAgent, agents, agentActivities]);

  // When agents start, spin to center on their locations
  useEffect(() => {
    const runningAgents = agents.filter(a => a.status === 'running' || agentActivities[a.agentId]?.isActive);
    
    // Only recalculate when agents start running (not every activity update)
    if (runningAgents.length === 0) return;
    
    // Collect all agent locations
    const agentLocations: Array<{lat: number, lng: number}> = [];
    
    runningAgents.forEach(agent => {
      const activity = agentActivities[agent.agentId];
      const location = activity?.location || agent.targeting?.location;
      
      if (location) {
        const coords = geocodeLocation(location);
        if (coords) {
          agentLocations.push(coords);
        }
      }
    });
    
    // Calculate center point (average of all locations)
    if (agentLocations.length > 0) {
      const avgLat = agentLocations.reduce((sum, loc) => sum + loc.lat, 0) / agentLocations.length;
      const avgLng = agentLocations.reduce((sum, loc) => sum + loc.lng, 0) / agentLocations.length;
      
      // Set target rotation to center on this location (keep same tilt/latitude)
      const targetLng = -avgLng;
      const targetLat = rotation[1]; // Keep current tilt
      
      console.log('🎯 Centering globe on agents:', {
        runningAgents: runningAgents.length,
        locations: agentLocations.length,
        avgLng,
        targetLng,
        currentRotation: rotation
      });
      
      // Only update if significantly different from current position
      const currentLng = rotation[0];
      
      if (Math.abs(targetLng - currentLng) > 10) {
        console.log('🔄 Starting rotation animation to:', [targetLng, targetLat]);
        setTargetRotation([targetLng, targetLat]);
        setIsAnimatingToAgent(true);
      }
    }
  }, [agents, agentActivities]);

  // Animate to target rotation when agent is clicked
  useEffect(() => {
    if (!targetRotation || !isAnimatingToAgent) return;
    
    const animate = () => {
      setRotation(prev => {
        const deltaLng = targetRotation[0] - prev[0];
        const deltaLat = targetRotation[1] - prev[1];
        
        // If close enough, snap to target and stop animating
        if (Math.abs(deltaLng) < 0.5 && Math.abs(deltaLat) < 0.5) {
          setIsAnimatingToAgent(false);
          setTargetRotation(null);
          return targetRotation;
        }
        
        // Move towards target
        return [
          prev[0] + deltaLng * 0.1,
          prev[1] + deltaLat * 0.1
        ];
      });
    };
    
    const interval = setInterval(animate, 16);
    return () => clearInterval(interval);
  }, [targetRotation, isAnimatingToAgent]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Country selection disabled
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!isMounted) {
    return (
      <div suppressHydrationWarning className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div className="text-2xl font-semibold text-white">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="min-h-screen bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] relative overflow-y-auto sm:overflow-hidden">
      {/* Meridian Logo */}
      <div className="sm:fixed relative px-4 pt-4 sm:top-4 sm:left-4 sm:p-0 sm:top-8 sm:left-8 z-50">
        <div className="flex items-center gap-2 sm:gap-3">
          <svg width="34" height="34" viewBox="0 0 48 48" className="drop-shadow-lg sm:w-10 sm:h-10">
            <ellipse cx="24" cy="24" rx="6" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="14" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="20" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="8" fill="none" stroke="white" strokeWidth="1.5"/>
            <ellipse cx="24" cy="24" rx="20" ry="16" fill="none" stroke="white" strokeWidth="1.5"/>
            <line x1="4" y1="24" x2="44" y2="24" stroke="white" strokeWidth="1.5"/>
          </svg>
          <div className="text-white text-lg sm:text-2xl font-bold">
            Meridian
          </div>
        </div>
      </div>

      {/* User Menu & Help - Positioned within Command Center bounds */}
      <div className="fixed top-4 right-8 z-50 flex items-center gap-3">
        {/* Help icon for mobile, full button for desktop */}
        <button
          onClick={() => {/* Open help - can add HelpChat trigger here */}}
          className="sm:hidden flex items-center justify-center w-10 h-10 bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm rounded-xl border border-white/20 transition-all"
          aria-label="Help"
        >
          <span className="text-lg font-bold">?</span>
        </button>
        <div className="sm:block hidden">
          <HelpChat />
        </div>
        <div className="[&_button]:!bg-white/20 [&_button]:hover:!bg-white/30 [&_button]:!text-white [&_button]:backdrop-blur-sm [&_button]:rounded-xl [&_div>div>div:nth-child(2)_button]:!text-neutral-900 [&_div>div>div:nth-child(2)_button]:hover:!bg-neutral-50 [&_div>div>div:nth-child(3)_button]:!text-red-600 [&_div>div>div:nth-child(3)_button]:hover:!bg-red-50">
          <UserMenu />
        </div>
      </div>

      {/* Top Navigation Buttons */}
      <div className="sm:fixed relative px-2 pt-10 sm:pt-0 sm:top-6 sm:left-[47%] sm:-translate-x-1/2 sm:right-auto z-50">
          {/* Mobile: Full width 2x2 Grid, Desktop: Centered single line */}
          <div className="flex flex-col gap-2 sm:block">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap sm:gap-3 sm:justify-center">
              <button
                onClick={() => { 
                  setNavigating(true); 
                  setTimeout(() => router.push('/agents-overview'), 0);
                }}
                className="relative px-3 py-2.5 sm:px-8 sm:py-3 sm:w-[280px] text-white rounded-lg sm:rounded-xl backdrop-blur-md transition-all border-2 border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:scale-105 hover:brightness-110 hover:shadow-xl hover:shadow-[#4FD1FF]/30 flex items-center justify-center gap-2 text-xs sm:text-2xl font-semibold shadow-lg shadow-[#4FD1FF]/10 overflow-hidden active:scale-95"
                style={{ background: 'radial-gradient(circle at center, rgba(79, 209, 255, 0.15) 0%, rgba(27, 47, 82, 0.9) 70%)' }}
              >
                Agents
              </button>
              <button
                onClick={() => { 
                  setNavigating(true); 
                  setTimeout(() => router.push('/profile'), 0);
                }}
                className="relative px-3 py-2.5 sm:px-8 sm:py-3 sm:w-[280px] text-white rounded-lg sm:rounded-xl backdrop-blur-md transition-all border-2 border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:scale-105 hover:brightness-110 hover:shadow-xl hover:shadow-[#4FD1FF]/30 flex items-center justify-center gap-2 text-xs sm:text-2xl font-semibold shadow-lg shadow-[#4FD1FF]/10 overflow-hidden active:scale-95"
                style={{ background: 'radial-gradient(circle at center, rgba(79, 209, 255, 0.15) 0%, rgba(27, 47, 82, 0.9) 70%)' }}
              >
                Profile
              </button>
              <button
                onClick={() => { 
                  setNavigating(true); 
                  setTimeout(() => router.push('/analytics'), 0);
                }}
                className="relative px-3 py-2.5 sm:px-8 sm:py-3 sm:w-[280px] text-white rounded-lg sm:rounded-xl backdrop-blur-md transition-all border-2 border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:scale-105 hover:brightness-110 hover:shadow-xl hover:shadow-[#4FD1FF]/30 flex items-center justify-center gap-2 text-xs sm:text-2xl font-semibold shadow-lg shadow-[#4FD1FF]/10 overflow-hidden active:scale-95"
                style={{ background: 'radial-gradient(circle at center, rgba(79, 209, 255, 0.15) 0%, rgba(27, 47, 82, 0.9) 70%)' }}
              >
                Analytics
              </button>
              <button
                onClick={() => { 
                  setNavigating(true); 
                  setTimeout(() => router.push('/settings'), 0);
                }}
                className="px-3 py-2.5 sm:px-8 sm:py-3 sm:w-[280px] text-white rounded-lg sm:rounded-xl backdrop-blur-md transition-all border-2 border-[#4FD1FF]/30 hover:border-[#4FD1FF]/60 hover:scale-105 hover:brightness-110 hover:shadow-xl hover:shadow-[#4FD1FF]/30 flex items-center justify-center gap-2 text-xs sm:text-2xl font-semibold shadow-lg shadow-[#4FD1FF]/10 overflow-hidden active:scale-95"
                style={{ background: 'radial-gradient(circle at center, rgba(79, 209, 255, 0.15) 0%, rgba(27, 47, 82, 0.9) 70%)' }}
              >
                Settings
              </button>
            </div>
            
            {/* Email Stats - Mobile only */}
            <div className="sm:hidden grid grid-cols-2 gap-2 w-full">
              {/* Email Queue */}
              <button
                onClick={() => handleQueueClick('queued', 'Email Queue')}
                className="bg-[#1B2F52]/90 rounded-xl p-4 border border-[#4FD1FF]/30 hover:bg-[#2A4472] hover:shadow-lg hover:shadow-[#4FD1FF]/20 transition-all cursor-pointer text-left active:scale-95 shadow-md"
              >
                <div className="text-[#A3B4CC] text-xs mb-1">Email Queue</div>
                <div className="text-2xl font-bold text-white">{stats.emailsQueued}</div>
              </button>

              {/* Emails Sent */}
              <button
                onClick={() => handleQueueClick('sent', 'Sent Emails')}
                className="bg-[#1B2F52]/90 rounded-xl p-4 border border-[#4FD1FF]/30 hover:bg-[#2A4472] hover:shadow-lg hover:shadow-[#4FD1FF]/20 transition-all cursor-pointer text-left active:scale-95 shadow-md"
              >
                <div className="text-[#A3B4CC] text-xs mb-1">Sent</div>
                <div className="text-2xl font-bold text-white">{stats.emailsSent}</div>
              </button>
            </div>

            {/* Start/Stop All Toggle Button - Mobile only */}
            <button
              onClick={async () => {
                const allRunning = agents.every(a => a.status === 'running');
                if (allRunning) {
                  // Optimistic update - immediately show as stopped
                  setAgents(prev => prev.map(a => ({ ...a, status: 'stopped' })));
                  setAgentActivities({});
                  
                  // Stop all
                  for (const agent of agents) {
                    try {
                      await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                    } catch (error) {
                      console.error('Error stopping agent:', error);
                    }
                  }
                } else {
                  // Optimistic update - immediately show as running
                  setAgents(prev => prev.map(a => ({ ...a, status: 'running' })));
                  
                  // Start all
                  for (const agent of agents) {
                    if (agent.status !== 'running') {
                      try {
                        await api.post('/api/lead-agent/start', { agentId: agent.agentId });
                      } catch (error) {
                        console.error('Error starting agent:', error);
                      }
                    }
                  }
                }
                await fetchAgents();
              }}
              className={`sm:hidden w-full px-3 py-2.5 rounded-lg backdrop-blur-md transition-all border-2 flex items-center justify-center gap-2 text-xs font-semibold shadow-lg ${
                agents.every(a => a.status === 'running')
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40 hover:border-red-500/60'
                  : 'bg-[#4FD1FF]/20 hover:bg-[#4FD1FF]/30 text-[#4FD1FF] border-[#4FD1FF]/40 hover:border-[#4FD1FF]/60'
              }`}
            >
              {agents.every(a => a.status === 'running') ? 'Stop All Agents' : 'Start All Agents'}
            </button>
          </div>
        </div>

      {/* Info Dashboard - Right Side on desktop, after navigation on mobile */}
      <>
        <div className="hidden lg:block">
          <InfoDashboard agents={agents} agentActivities={agentActivities} showGlobe={showGlobe} setShowGlobe={handleGlobeToggle} />
        </div>
        <div className="lg:hidden">
          <InfoDashboard agents={agents} agentActivities={agentActivities} showGlobe={showGlobe} setShowGlobe={handleGlobeToggle} />
        </div>
      </>

      {/* Loading Overlay - only for navigation, not for queue modal */}
      {navigating && (
        <div className="fixed inset-0 bg-gradient-to-br from-[#0F1E35] via-[#1B2F52] to-[#223A63] z-[9999] flex items-center justify-center">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className="text-2xl font-semibold text-white">Loading...</p>
          </div>
        </div>
      )}

      {/* Human Review Label - Left Side */}
      <div className="hidden xl:block fixed left-2 xl:left-4 z-35" style={{ top: 'calc(10% + 10px)', width: '240px' }}>
        <div className="text-center py-2 bg-[#0F1E35] rounded-lg">
          <h2 className="text-[#4FD1FF] text-sm font-bold uppercase tracking-[0.3em]">Human Review</h2>
        </div>
      </div>

      {/* System Label - Center */}
      <div 
        className={`hidden xl:block fixed left-[280px] right-[380px] z-35 transition-opacity duration-700 ${
          showGlobe ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`} 
        style={{ top: 'calc(10% + 10px)' }}
      >
        <div className="text-center py-2 bg-[#0F1E35] rounded-lg">
          <h2 className="text-[#4FD1FF] text-sm font-bold uppercase tracking-[0.3em]">System</h2>
        </div>
      </div>

      {/* Stats Panel - Left Side, hidden on small/medium screens */}
      <div className="hidden xl:flex fixed left-4 xl:left-8 z-40 flex-col gap-5" style={{ top: 'calc(10% + 60px)' }}>
        {/* Email Queue - Formula: 50 + (n × 20), 61 colors then WHITE */}
        <div className="p-4 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
          <button
            onClick={() => handleQueueClick('queued', 'Email Queue')}
            className="relative w-[180px] h-[180px] hover:scale-105 transition-all duration-200 cursor-pointer active:scale-95 flex flex-col items-center justify-center group"
          >
            {/* Progress Ring */}
            <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
              <defs>
                <radialGradient id="innerGlow-queue" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" style={{ stopColor: 'rgba(79, 209, 255, 0.35)', stopOpacity: 1 }} />
                  <stop offset="100%" style={{ stopColor: 'rgba(79, 209, 255, 0)', stopOpacity: 1 }} />
                </radialGradient>
              </defs>
              <circle cx="50%" cy="50%" r="45%" fill="url(#innerGlow-queue)" />
              <circle
                cx="50%"
                cy="50%"
                r="80"
                fill="none"
                stroke="rgba(79, 209, 255, 0.3)"
                strokeWidth="3"
              />
              <circle
                cx="50%"
                cy="50%"
                r="80"
                fill="none"
                stroke={
                  (() => {
                    let level = 0;
                    let count = stats.emailsQueued;
                    let milestone = 50;
                    while (count >= milestone) {
                      count -= milestone;
                      level++;
                      milestone = 50 + (level * 20);
                    }
                    const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
                    return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
                  })()
                }
                strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 80}`}
                strokeDashoffset={
                  (() => {
                    let level = 0;
                    let count = stats.emailsQueued;
                    let milestone = 50;
                    while (count >= milestone) {
                      count -= milestone;
                      level++;
                      milestone = 50 + (level * 20);
                    }
                    const currentMilestone = 50 + (level * 20);
                    const progress = count / currentMilestone;
                    return 2 * Math.PI * 80 * (1 - progress);
                  })()
                }
                className="transition-all duration-500"
                style={{
                  filter: 'drop-shadow(0 0 6px currentColor) drop-shadow(0 0 12px currentColor)',
                }}
              />
            </svg>
            <div className="relative z-10 text-center">
              <div className="text-[#A3B4CC] text-xs mb-1.5">Email Queue</div>
              <div className="text-5xl font-bold text-white mb-1">{stats.emailsQueued}</div>
              <div className="text-[#8FA6C1] text-[9px] font-medium">
                Next: {(() => {
                  let level = 0;
                  let count = stats.emailsQueued;
                  let milestone = 50;
                  while (count >= milestone) {
                    count -= milestone;
                    level++;
                    milestone = 50 + (level * 20);
                  }
                  const currentMilestone = 50 + (level * 20);
                  return `${count}/${currentMilestone}`;
                })()}
              </div>
              <div className="text-[#8FA6C1] text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Click to view</div>
            </div>
          </button>
        </div>

        {/* Emails Sent - Formula: 25 + (n × 10), 61 colors then WHITE */}
        <div className="p-4 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
          <button
            onClick={() => handleQueueClick('sent', 'Sent Emails')}
            className="relative w-[180px] h-[180px] hover:scale-105 transition-all duration-200 cursor-pointer active:scale-95 flex flex-col items-center justify-center group"
          >
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <defs>
              <radialGradient id="innerGlow-sent" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style={{ stopColor: 'rgba(79, 209, 255, 0.35)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgba(79, 209, 255, 0)', stopOpacity: 1 }} />
              </radialGradient>
            </defs>
            <circle cx="50%" cy="50%" r="45%" fill="url(#innerGlow-sent)" />
            <circle
              cx="50%"
              cy="50%"
              r="80"
              fill="none"
              stroke="rgba(79, 209, 255, 0.3)"
              strokeWidth="3"
            />
            <circle
              cx="50%"
              cy="50%"
              r="80"
              fill="none"
              stroke={
                (() => {
                  let level = 0;
                  let count = stats.emailsSent;
                  let milestone = 25;
                  while (count >= milestone) {
                    count -= milestone;
                    level++;
                    milestone = 25 + (level * 10);
                  }
                  const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
                  return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
                })()
              }
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={
                (() => {
                  let level = 0;
                  let count = stats.emailsSent;
                  let milestone = 25;
                  while (count >= milestone) {
                    count -= milestone;
                    level++;
                    milestone = 25 + (level * 10);
                  }
                  const currentMilestone = 25 + (level * 10);
                  const progress = count / currentMilestone;
                  return 2 * Math.PI * 80 * (1 - progress);
                })()
              }
              className="transition-all duration-500"
              style={{
                filter: 'drop-shadow(0 0 6px currentColor) drop-shadow(0 0 12px currentColor)',
              }}
            />
          </svg>
          <div className="relative z-10 text-center">
            <div className="text-[#A3B4CC] text-xs mb-1.5">Sent</div>
            <div className="text-5xl font-bold text-white mb-1">{stats.emailsSent}</div>
            <div className="text-[#8FA6C1] text-[9px] font-medium">
              Next: {(() => {
                let level = 0;
                let count = stats.emailsSent;
                let milestone = 25;
                while (count >= milestone) {
                  count -= milestone;
                  level++;
                  milestone = 25 + (level * 10);
                }
                const currentMilestone = 25 + (level * 10);
                return `${count}/${currentMilestone}`;
              })()}
            </div>
            <div className="text-[#8FA6C1] text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">Click to view</div>
          </div>
        </button>
      </div>

        {/* Interacted - Formula: 10 + (n × 10), 61 colors then WHITE */}
        <div className="p-4 bg-[#1B2F52]/60 rounded-xl border border-[#4FD1FF]/20">
          <div
            className="relative w-[180px] h-[180px] opacity-90 flex flex-col items-center justify-center"
          >
          {/* Progress Ring */}
          <svg className="absolute inset-0 w-full h-full" style={{ transform: 'rotate(-90deg)' }}>
            <defs>
              <radialGradient id="innerGlow-interacted" cx="50%" cy="50%" r="50%">
                <stop offset="0%" style={{ stopColor: 'rgba(79, 209, 255, 0.35)', stopOpacity: 1 }} />
                <stop offset="100%" style={{ stopColor: 'rgba(79, 209, 255, 0)', stopOpacity: 1 }} />
              </radialGradient>
            </defs>
            <circle cx="50%" cy="50%" r="45%" fill="url(#innerGlow-interacted)" />
            <circle
              cx="50%"
              cy="50%"
              r="80"
              fill="none"
              stroke="rgba(79, 209, 255, 0.3)"
              strokeWidth="3"
            />
            <circle
              cx="50%"
              cy="50%"
              r="80"
              fill="none"
              stroke={
                (() => {
                  let level = 0;
                  let count = stats.emailsViewed;
                  let milestone = 10;
                  while (count >= milestone) {
                    count -= milestone;
                    level++;
                    milestone = 10 + (level * 10);
                  }
                  const colors = ['#3d3d3d','#505050','#636363','#767676','#898989','#9c9c9c','#afafaf','#c2c2c2','#d5d5d5','#e8e8e8','#00ff7f','#00f566','#00eb4d','#00e134','#00d71b','#00cd02','#1ac300','#33b900','#4daf00','#66a500','#006aff','#0077ff','#0084ff','#0091ff','#009eff','#00abff','#00b8ff','#00c5ff','#00d2ff','#00dfff','#8b00ff','#9500ff','#9f00ff','#a900ff','#b300ff','#bd00ff','#c700ff','#d100ff','#db00ff','#e500ff','#ffaa00','#ffb700','#ffc400','#ffd100','#ffde00','#ffeb00','#fff800','#ffff05','#ffff33','#ffff61','#ff0000','#ff1a00','#ff3300','#ff4d00','#ff6600','#ff8000','#ff9900','#ffb300','#ffcc00','#ffe600','#000000'];
                  return level > 60 ? '#FFFFFF' : colors[Math.min(level, 60)];
                })()
              }
              strokeWidth="4"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={
                (() => {
                  let level = 0;
                  let count = stats.emailsViewed;
                  let milestone = 10;
                  while (count >= milestone) {
                    count -= milestone;
                    level++;
                    milestone = 10 + (level * 10);
                  }
                  const currentMilestone = 10 + (level * 10);
                  const progress = count / currentMilestone;
                  return 2 * Math.PI * 80 * (1 - progress);
                })()
              }
              className="transition-all duration-500"
              style={{
                filter: 'drop-shadow(0 0 6px currentColor) drop-shadow(0 0 12px currentColor)',
              }}
            />
          </svg>
          <div className="relative z-10 text-center">
            <div className="text-[#A3B4CC] text-xs mb-1.5">Interacted</div>
            <div className="text-5xl font-bold text-white mb-1">{stats.emailsViewed}</div>
            <div className="text-[#8FA6C1] text-[9px] font-medium">
              Next: {(() => {
                let level = 0;
                let count = stats.emailsViewed;
                let milestone = 10;
                while (count >= milestone) {
                  count -= milestone;
                  level++;
                  milestone = 10 + (level * 10);
                }
                const currentMilestone = 10 + (level * 10);
                return `${count}/${currentMilestone}`;
              })()}
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* Outreach Section - Center of Dashboard */}
      <div 
        className={`hidden xl:flex fixed left-[280px] right-[380px] flex-col gap-4 z-30 transition-opacity duration-700 ${
          showGlobe ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`} 
        style={{ top: 'calc(10% + 60px)' }}
      >
        {/* Stats Row - Square boxes */}
        <div className="grid grid-cols-3 gap-4">
          {/* Opens */}
          <div className="relative rounded-lg border-2 border-[#4FD1FF]/40 hover:border-[#4FD1FF]/60 p-4 h-[90px] flex flex-col justify-between transition-all duration-200 shadow-lg overflow-hidden" style={{ background: 'radial-gradient(circle at center, rgba(79, 209, 255, 0.15) 0%, rgba(27, 47, 82, 0.95) 70%)' }}>
            <div className="text-[#A3B4CC] text-xs font-medium uppercase tracking-wider">Opens</div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold text-white">{stats.emailsViewed}</div>
              <div className="text-[#4FD1FF] text-sm font-medium">
                {stats.emailsSent > 0 ? `${Math.round((stats.emailsViewed / stats.emailsSent) * 100)}%` : '0%'}
              </div>
            </div>
          </div>

          {/* Responses */}
          <div className="relative rounded-lg border-2 border-[#4FD1FF]/40 hover:border-[#4FD1FF]/60 p-4 h-[90px] flex flex-col justify-between transition-all duration-200 shadow-lg overflow-hidden" style={{ background: 'radial-gradient(circle at center, rgba(79, 209, 255, 0.15) 0%, rgba(27, 47, 82, 0.95) 70%)' }}>
            <div className="text-[#A3B4CC] text-xs font-medium uppercase tracking-wider">Responses</div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold text-white">0</div>
              <div className="text-[#4FD1FF] text-sm font-medium">0%</div>
            </div>
          </div>

          {/* Bounced */}
          <div className="relative rounded-lg border-2 border-red-500/40 hover:border-red-500/60 p-4 h-[90px] flex flex-col justify-between transition-all duration-200 shadow-lg overflow-hidden" style={{ background: 'radial-gradient(circle at center, rgba(239, 68, 68, 0.15) 0%, rgba(27, 47, 82, 0.95) 70%)' }}>
            <div className="text-[#A3B4CC] text-xs font-medium uppercase tracking-wider">Bounced</div>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold text-white">0</div>
              <div className="text-red-400 text-sm font-medium">0%</div>
            </div>
          </div>
        </div>

        {/* Email Activity Log */}
        <div className="bg-[#1B2F52]/95 rounded-lg border-2 border-[#4FD1FF]/40 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Email Activity</h3>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setActivityFilter('all')}
                className={`text-[10px] px-2 py-1 rounded transition-all border font-medium ${
                  activityFilter === 'all' 
                    ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                    : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                }`}
              >
                All
              </button>
              <button 
                onClick={() => setActivityFilter('sent')}
                className={`text-[10px] px-2 py-1 rounded transition-all border font-medium ${
                  activityFilter === 'sent' 
                    ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                    : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                }`}
              >
                Sent
              </button>
              <button 
                onClick={() => setActivityFilter('opened')}
                className={`text-[10px] px-2 py-1 rounded transition-all border font-medium ${
                  activityFilter === 'opened' 
                    ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                    : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                }`}
              >
                Opened
              </button>
              <button 
                onClick={() => setActivityFilter('bounced')}
                className={`text-[10px] px-2 py-1 rounded transition-all border font-medium ${
                  activityFilter === 'bounced' 
                    ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-[#4FD1FF]/40' 
                    : 'text-[#8FA6C1] hover:bg-white/10 border-transparent'
                }`}
              >
                Bounced
              </button>
              <span className="text-[10px] text-[#8FA6C1] ml-2">{emailActivity.length} emails</span>
            </div>
          </div>
          
          <div className="space-y-2 h-[450px] overflow-y-auto">
            {emailActivity.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 bg-[#4FD1FF]/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-[#8FA6C1] text-sm">No email activity yet</p>
                <p className="text-[#8FA6C1]/60 text-xs mt-2">Sent emails will appear here</p>
              </div>
            ) : (
              emailActivity
                .filter(email => {
                  if (activityFilter === 'all') return true;
                  if (activityFilter === 'opened') return email.analyticsStatus?.opened;
                  if (activityFilter === 'sent') return !email.analyticsStatus?.opened; // Sent but not opened
                  if (activityFilter === 'bounced') return email.status === 'bounced';
                  return true;
                })
                .map((email, idx) => {
                  const hasOpened = email.analyticsStatus?.opened;
                  const hasClicked = email.analyticsStatus?.clicked;
                  const hasReplied = email.analyticsStatus?.replied;
                  const isBounced = email.status === 'bounced';
                  const timeAgo = new Date(email.sentAt || email.timestamp).toLocaleString();
                  
                  return (
                    <div 
                      key={email.trackingId || email.id || idx} 
                      className="bg-[#0F1E35]/60 rounded-lg p-3 border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            hasReplied ? 'bg-purple-400' : hasClicked ? 'bg-yellow-400' : hasOpened ? 'bg-green-400' : isBounced ? 'bg-red-400' : 'bg-blue-400'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-white text-xs font-medium truncate">
                              {email.to || email.recipient || 'Unknown'}
                            </div>
                            <div className="text-[#8FA6C1] text-[10px] mt-0.5 truncate">
                              {email.subject || 'No subject'}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {hasReplied && (
                                <span className="text-[9px] text-purple-400 font-medium">Replied</span>
                              )}
                              {hasClicked && (
                                <span className="text-[9px] text-yellow-400 font-medium">Clicked</span>
                              )}
                              {hasOpened && (
                                <span className="text-[9px] text-green-400 font-medium">
                                  Opened {email.analyticsStatus?.openCount > 1 ? `(${email.analyticsStatus.openCount}x)` : ''}
                                </span>
                              )}
                              {!hasOpened && !isBounced && (
                                <span className="text-[9px] text-[#8FA6C1] font-medium">Sent</span>
                              )}
                              {isBounced && (
                                <span className="text-[9px] text-red-400 font-medium">Bounced</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-[#8FA6C1] text-[9px] whitespace-nowrap ml-2">
                          {timeAgo}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* Control Switches */}
        <div className="grid grid-cols-3 gap-3">
          {/* Auto-Send Toggle */}
          <button 
            className="bg-[#1B2F52]/95 rounded-lg border-2 border-[#4FD1FF]/40 hover:border-[#4FD1FF]/60 p-3 h-[60px] flex items-center justify-between transition-all duration-200 hover:bg-[#2A4472] shadow-lg active:scale-[0.98]"
          >
            <div className="text-[#A3B4CC] text-[10px] font-medium uppercase tracking-wider">Auto-Send</div>
            <div className="w-11 h-6 bg-green-500/30 rounded-full border-2 border-green-500 relative">
              <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-green-500 rounded-full shadow-lg"></div>
            </div>
          </button>

          {/* Email Tracking Toggle */}
          <button 
            className="bg-[#1B2F52]/95 rounded-lg border-2 border-[#4FD1FF]/40 hover:border-[#4FD1FF]/60 p-3 h-[60px] flex items-center justify-between transition-all duration-200 hover:bg-[#2A4472] shadow-lg active:scale-[0.98]"
          >
            <div className="text-[#A3B4CC] text-[10px] font-medium uppercase tracking-wider">Tracking</div>
            <div className="w-11 h-6 bg-green-500/30 rounded-full border-2 border-green-500 relative">
              <div className="absolute right-0.5 top-0.5 w-4 h-4 bg-green-500 rounded-full shadow-lg"></div>
            </div>
          </button>

          {/* Active Agents Display */}
          <div className="bg-[#1B2F52]/95 rounded-lg border-2 border-[#4FD1FF]/40 p-3 h-[60px] flex items-center justify-between shadow-lg overflow-hidden">
            <div className="text-[#A3B4CC] text-[10px] font-medium uppercase tracking-wider">Active</div>
            {agents.filter(a => agentActivities[a.agentId]?.isActive || a.status === 'running').length > 0 ? (
              <div className="flex -space-x-1.5">
                {agents
                  .filter(a => agentActivities[a.agentId]?.isActive || a.status === 'running')
                  .slice(0, 3)
                  .map((agent) => {
                    const avatarSrc = agent.avatar || agent.personality?.avatar;
                    return (
                      <div
                        key={agent.agentId}
                        className="relative group"
                        title={agent.name}
                      >
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={agent.name}
                            className="w-7 h-7 rounded-full border-2 border-[#4FD1FF]/50 object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full border-2 border-[#4FD1FF]/50 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {agent.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-white/50 animate-pulse" />
                      </div>
                    );
                  })}
                {agents.filter(a => agentActivities[a.agentId]?.isActive || a.status === 'running').length > 3 && (
                  <div className="w-7 h-7 rounded-full border-2 border-[#4FD1FF]/50 bg-[#1B2F52] flex items-center justify-center text-[#4FD1FF] text-[10px] font-bold">
                    +{agents.filter(a => agentActivities[a.agentId]?.isActive || a.status === 'running').length - 3}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[#8FA6C1] text-xs">None</div>
            )}
          </div>
        </div>
      </div>

      {/* Globe - Hidden on mobile */}
      {isMounted && (
        <div 
          className={`hidden sm:block fixed left-1/2 -translate-x-1/2 top-[200px] transition-all duration-700 ease-out ${
            showGlobe || isAnimatingOut ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
        <div className="text-center relative">
          {/* Start/Stop All Agents Button - Above Globe */}
          {(showGlobe || isAnimatingOut) && !globeLoading && (
            <div className={`mb-8 relative inline-block transition-all duration-500 ${!showGlobe && isAnimatingOut ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
              <button
                onClick={async () => {
                  const runningAgents = agents.filter(a => a.status === 'running');
                  const idleAgents = agents.filter(a => a.status !== 'running');
                  
                  // If all agents are running, stop them all
                  if (idleAgents.length === 0 && runningAgents.length > 0) {
                    // Optimistic update - immediately show as stopped
                    setAgents(prev => prev.map(a => ({ ...a, status: 'stopped' })));
                    setAgentActivities({});
                    
                    try {
                      await Promise.all(
                        runningAgents.map(agent => 
                          api.post('/api/lead-agent/stop', { agentId: agent.agentId })
                        )
                      );
                      await fetchAgents();
                    } catch (error) {
                      console.error('Error stopping agents:', error);
                      await fetchAgents(); // Refresh to get actual state
                    }
                    return;
                  }
                  
                  // Otherwise, start all idle agents
                  if (idleAgents.length === 0) {
                    return;
                  }
                  
                  // Optimistically update UI immediately
                  setAgents(prev => prev.map(a => 
                    idleAgents.find(idle => idle.agentId === a.agentId)
                      ? { ...a, status: 'running' }
                      : a
                  ));
                  
                  const newActivities: {[key: string]: any} = {};
                  idleAgents.forEach(agent => {
                    newActivities[agent.agentId] = {
                      status: 'Starting...',
                      timestamp: Date.now(),
                      location: agent.targeting?.location || null,
                      targeting: agent.targeting || null,
                      isActive: true
                    };
                  });
                  setAgentActivities(prev => ({ ...prev, ...newActivities }));
                  
                  try {
                    await Promise.all(
                      idleAgents.map(agent => 
                        api.post('/api/lead-agent/start', { agentId: agent.agentId })
                      )
                    );
                    await fetchAgents();
                  } catch (error) {
                    console.error('Error starting agents:', error);
                    await fetchAgents(); // Refresh to get actual state
                  }
                }}
                className="px-8 py-3 bg-gradient-to-r from-[#4FD1FF] via-[#55C7F7] to-[#6BE3FF] text-[#0F1E35] rounded-xl font-bold text-lg hover:shadow-lg hover:shadow-[#4FD1FF]/30 hover:scale-105 transition-all active:scale-95"
              >
                {agents.filter(a => a.status !== 'running').length === 0 && agents.filter(a => a.status === 'running').length > 0
                  ? 'Stop All Agents'
                  : 'Start All Agents'
                }
              </button>
            </div>
          )}
          
          {/* Loading Bar */}
          {showGlobe && globeLoading && (
            <div className="w-full max-w-5xl mx-auto px-4 mb-8 animate-fadeIn">
              <div className="bg-[#0F1E35] rounded-lg p-4 border border-[#4FD1FF]/30">
                <p className="text-[#4FD1FF] text-center text-sm font-medium mb-3">Initializing Globe...</p>
                <div className="bg-[#1B2F52] rounded-full h-3 overflow-hidden border border-[#4FD1FF]/50">
                  <div 
                    className="h-full bg-gradient-to-r from-[#4FD1FF] to-[#6BE3FF]"
                    style={{
                      width: '0%',
                      animation: 'progressBar 2s ease-out forwards',
                      boxShadow: '0 0 15px rgba(79,209,255,0.8)'
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Globe Canvas */}
          {(showGlobe || isAnimatingOut) && !globeLoading ? (
            <canvas
              ref={canvasRef}
              className={`cursor-default transition-all duration-500 ${!showGlobe && isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
              onClick={handleCanvasClick}
            />
          ) : null}
        </div>
      </div>
      )}

      {/* Animated Satellite - Hidden on mobile and medium screens */}
      {(showGlobe || isAnimatingOut) && !globeLoading && (
        <div 
          className={`fixed right-[calc(50%+18rem)] lg:right-[22rem] xl:right-[26rem] top-1/2 pointer-events-auto cursor-pointer z-50 hidden lg:block transition-all duration-500 ${!showGlobe && isAnimatingOut ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}
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
              <div className="absolute -top-2 -right-2 bg-white text-black text-xs rounded-full min-w-6 h-6 px-2 flex items-center justify-center font-bold shadow-lg">
                {agents.filter(a => !agentActivities[a.agentId]?.isActive && a.status !== 'running').length}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email Dots on Globe (color-coded by status) */}
      {showGlobe && emailDots.map((email) => {
        // Project email location to screen coordinates
        const baseScale = canvasSize / 2.0;
        const centerPos = canvasSize / 2;
        const projection = geoOrthographic()
          .scale(baseScale)
          .rotate(rotation)
          .translate([centerPos, centerPos]);
        
        const coords = projection([email.location.lng, email.location.lat]);
        if (!coords) return null;
        
        // Calculate screen position (same as agent positioning)
        const canvasCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
        const canvasCenterY = typeof window !== 'undefined' ? window.innerHeight : 0;
        const pointX = canvasCenterX + (coords[0] - centerPos);
        const pointY = canvasCenterY + (coords[1] - centerPos);
        
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
      {showGlobe && agents.map((agent, index) => {
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
        const baseScale = canvasSize / 2.0;
        const centerPos = canvasSize / 2;
        const projection = geoOrthographic()
          .scale(baseScale)
          .rotate(rotation)
          .translate([centerPos, centerPos]);
        
        const coords = projection([lng, lat]);
        if (!coords) return null;
        
        // Canvas position: bottom-[-40%] means bottom edge is at 140% viewport height
        // Canvas center Y = 1.4 * viewport height - half canvas size
        const canvasCenterX = typeof window !== 'undefined' ? window.innerWidth / 2 : 0;
        const canvasCenterY = typeof window !== 'undefined' ? (1.4 * window.innerHeight) - (canvasSize / 2) : 0;
        
        // Point position relative to canvas center
        const pointX = canvasCenterX + (coords[0] - centerPos);
        const pointY = canvasCenterY + (coords[1] - centerPos);
        
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
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">{agent.name}</span>
                </div>
                <div className="text-white/70 text-[10px]">{keywordText}</div>
              </div>
              
              {/* Avatar and Stop button */}
              <div className="flex items-center gap-2">
                <div className="relative group">
                  <button
                    onClick={() => {
                      setLoadingQueue(true);
                      router.push(`/agents?agent=${agent.agentId}&returnTo=/dashboard`);
                    }}
                    className="block transition-all duration-150 active:scale-90"
                  >
                    <img 
                      src={agent.avatar || agent.personality?.avatar} 
                      alt={agent.name}
                      className="w-10 h-10 rounded-full border-2 border-green-400 shadow-lg transition-all duration-150 hover:scale-110 hover:shadow-green-400/50 active:scale-95 active:shadow-green-400/80 cursor-pointer object-cover"
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

      {/* Idle Agents Modal */}
      {showIdleAgents && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-gradient-to-br from-[#1B2F52] via-[#223A63] to-[#2A4570] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[70vh] overflow-hidden flex flex-col border border-[#4FD1FF]/30">
            <div className="p-6 border-b border-white/20 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Idle Agents</h2>
              <button
                onClick={() => setShowIdleAgents(false)}
                className="text-white/70 hover:text-white transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
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
                      className="bg-[#1B2F52]/50 backdrop-blur-md rounded-xl p-4 border border-white/10 hover:border-[#4FD1FF]/30 transition-all"
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
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white">{agent.name}</span>
                            {agent.settings?.emailBuilder?.useGmail === true ? (
                              <span className="relative group/gmail inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/10 text-white text-[9px] border border-white/20">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 256 193" fill="none">
                                  <path d="M58.182 192.05V93.768L27.507 65.158L0 49.504v125.091c0 9.658 7.825 17.455 17.455 17.455h40.727Z" fill="#4285F4"/>
                                  <path d="M197.818 192.05h40.727c9.659 0 17.455-7.854 17.455-17.455V49.504l-31.274 17.278-27.506 28.61Z" fill="#34A853"/>
                                  <path d="M197.818 49.504V93.768l58.182-44.264V34.91c0-21.585-24.641-33.89-41.89-20.945Z" fill="#FBBC04"/>
                                  <path d="M58.182 93.768V49.504L128 105.23l69.818-55.726v44.264L128 149.494Z" fill="#EA4335"/>
                                  <path d="M0 34.91v14.594l58.182 44.264V49.504L40.727 37.072C23.478 24.019-.001 36.324 0 34.91Z" fill="#C5221F"/>
                                </svg>
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/gmail:opacity-100 transition-opacity pointer-events-none z-50">
                                  Gmail sending enabled
                                </span>
                              </span>
                            ) : (
                              <span className="relative group/domain inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[9px] border border-purple-500/40">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                                </svg>
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-black/90 text-white text-[10px] rounded whitespace-nowrap opacity-0 group-hover/domain:opacity-100 transition-opacity pointer-events-none z-50">
                                  Meridian domain sending enabled
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-white/70">{agent.personality?.name || 'Agent'}</div>
                          <div className="flex items-center gap-1.5 text-xs mt-1">
                            {agentActivities[agent.agentId]?.status ? (
                              <>
                                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                <span className="text-green-400 font-medium">Active</span>
                                <span className="text-white/50 mx-1">·</span>
                                <span className="text-cyan-300 truncate">{agentActivities[agent.agentId].status}</span>
                              </>
                            ) : (
                              <div className="text-white/50">Idle</div>
                            )}
                          </div>
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
                              // Immediately update agent status in state
                              setAgents(prev => prev.map(a => 
                                a.agentId === agent.agentId 
                                  ? { ...a, status: 'stopped' }
                                  : a
                              ));
                            } else {
                              setAgentActivities(prev => ({
                                ...prev,
                                [agent.agentId]: { 
                                  isActive: true, 
                                  status: 'Starting...', 
                                  timestamp: Date.now(),
                                  location: agent.targeting?.location || null,
                                  targeting: agent.targeting || null
                                }
                              }));
                              // Immediately update agent status in state
                              setAgents(prev => prev.map(a => 
                                a.agentId === agent.agentId 
                                  ? { ...a, status: 'running' }
                                  : a
                              ));
                            }
                            
                            try {
                              if (isCurrentlyRunning) {
                                await api.post('/api/lead-agent/stop', { agentId: agent.agentId });
                              } else {
                                await api.post('/api/lead-agent/start', { agentId: agent.agentId });
                              }
                              // Refetch agents to sync with backend database
                              await fetchAgents();
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
                            setLoadingQueue(true);
                            router.push(`/agents?agent=${agent.agentId}&returnTo=/dashboard`);
                          }}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/20 hover:bg-blue-500/30 active:bg-blue-500/50 active:scale-[0.95] text-blue-300 border border-blue-500/40 active:border-blue-400 transition-all duration-150"
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
        <div className="fixed inset-0 bg-black/50 z-[100]">
          <div 
            className="bg-gradient-to-br from-[#1B2F52] via-[#223A63] to-[#2A4570] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-[#4FD1FF]/30 absolute"
            style={{
              width: `${modalSize.width}px`,
              height: `${modalSize.height}px`,
              left: `${Math.round(modalPosition.x)}px`,
              top: `${Math.round(modalPosition.y)}px`,
              cursor: isDraggingModal ? 'grabbing' : 'default',
              maxWidth: '90vw',
              maxHeight: '90vh',
              backfaceVisibility: 'hidden',
              WebkitFontSmoothing: 'antialiased',
              willChange: isDraggingModal || isResizing ? 'transform, width, height' : 'auto'
            }}
          >
            {/* Modal Header */}
            <div 
              className="p-6 border-b border-[#4FD1FF]/30 flex items-center justify-between cursor-grab active:cursor-grabbing"
              onMouseDown={handleModalMouseDown}
            >
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
                  {selectedAgent ? selectedAgent.name : selectedQueue?.agentName || 'Queue'}
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

            {/* Resize Handles - Edges */}
            <div 
              className="resize-handle absolute top-0 left-0 right-0 h-2 cursor-n-resize hover:bg-white/20 transition-colors z-10"
              onMouseDown={handleResizeMouseDown('n')}
            />
            <div 
              className="resize-handle absolute right-0 top-0 bottom-0 w-2 cursor-e-resize hover:bg-white/20 transition-colors z-10"
              onMouseDown={handleResizeMouseDown('e')}
            />
            <div 
              className="resize-handle absolute bottom-0 left-0 right-0 h-2 cursor-s-resize hover:bg-white/20 transition-colors z-10"
              onMouseDown={handleResizeMouseDown('s')}
            />
            <div 
              className="resize-handle absolute left-0 top-0 bottom-0 w-2 cursor-w-resize hover:bg-white/20 transition-colors z-10"
              onMouseDown={handleResizeMouseDown('w')}
            />
            
            {/* Resize Handles - Corners */}
            <div 
              className="resize-handle absolute top-0 right-0 w-4 h-4 cursor-ne-resize"
              onMouseDown={handleResizeMouseDown('ne')}
            />
            <div 
              className="resize-handle absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
              onMouseDown={handleResizeMouseDown('se')}
            />
            <div 
              className="resize-handle absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
              onMouseDown={handleResizeMouseDown('sw')}
            />
            <div 
              className="resize-handle absolute top-0 left-0 w-4 h-4 cursor-nw-resize"
              onMouseDown={handleResizeMouseDown('nw')}
            />

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
                      const isOrphaned = agent.agentId === 'orphan';
                      return (
                        <button
                          key={agent.agentId}
                          onClick={() => handleAgentSelect(agent)}
                          className={`rounded-xl p-6 border hover:bg-white/20 active:bg-white/25 active:scale-[0.98] transition-all duration-150 text-left ${
                            isOrphaned 
                              ? 'bg-yellow-500/10 border-yellow-500/40' 
                              : 'bg-white/15 border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            {isOrphaned ? (
                              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                                <span className="text-yellow-400 text-xl">⚠️</span>
                              </div>
                            ) : avatarSrc ? (
                              <img 
                                src={avatarSrc} 
                                alt={agent.name}
                                className="w-10 h-10 rounded-full object-cover"
                                onError={(e) => {
                                  console.log('Failed to load avatar:', avatarSrc);
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <div className={`font-bold text-lg ${isOrphaned ? 'text-yellow-400' : 'text-white'}`}>
                              {agent.name}
                            </div>
                          </div>
                          <div className={`text-sm ${isOrphaned ? 'text-yellow-400/70' : 'text-white/70'}`}>
                            {isOrphaned ? 'From deleted agents' : (agent.personality?.name || 'Agent')}
                          </div>
                          <div className={`mt-3 text-xs ${isOrphaned ? 'text-yellow-400/50' : 'text-white/50'}`}>
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
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      <div className="text-2xl font-semibold text-white">Loading...</div>
                    </div>
                  </div>
                ) : queueEmails.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-white/70">No emails found</div>
                  </div>
                ) : (
                  <>
                    {/* Success Rate Graph (only for sent emails) */}
                    {selectedQueue?.type === 'sent' && queueEmails.length > 0 && (
                      <div className="mb-6 bg-white/10 rounded-xl p-4 border border-white/20">
                        <h3 className="text-white font-semibold mb-4">Delivery Success Rate</h3>
                        <div className="flex items-center gap-6">
                          {/* Success Rate Percentage */}
                          <div className="flex-shrink-0">
                            <div className="text-4xl font-bold text-[#4FD1FF]">
                              {Math.round((queueEmails.filter(e => e.deliveryStatus === 'delivered').length / queueEmails.length) * 100)}%
                            </div>
                            <div className="text-xs text-white/50 mt-1">Success Rate</div>
                          </div>
                          
                          {/* Bar Chart */}
                          <div className="flex-1">
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div className="text-center">
                                <div className="text-xs text-white/50 mb-1">Delivered</div>
                                <div className="text-lg font-bold text-green-400">
                                  {queueEmails.filter(e => e.deliveryStatus === 'delivered').length}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-white/50 mb-1">Bounced</div>
                                <div className="text-lg font-bold text-red-400">
                                  {queueEmails.filter(e => e.deliveryStatus === 'bounced').length}
                                </div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs text-white/50 mb-1">Pending</div>
                                <div className="text-lg font-bold text-yellow-400">
                                  {queueEmails.filter(e => !e.deliveryStatus || e.deliveryStatus === 'pending').length}
                                </div>
                              </div>
                            </div>
                            
                            {/* Progress bars */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-green-400 rounded-full transition-all duration-500"
                                    style={{width: `${(queueEmails.filter(e => e.deliveryStatus === 'delivered').length / queueEmails.length) * 100}%`}}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-red-400 rounded-full transition-all duration-500"
                                    style={{width: `${(queueEmails.filter(e => e.deliveryStatus === 'bounced').length / queueEmails.length) * 100}%`}}
                                  />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                                    style={{width: `${(queueEmails.filter(e => !e.deliveryStatus || e.deliveryStatus === 'pending').length / queueEmails.length) * 100}%`}}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Pagination Info */}
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/20">
                      <div className="text-white/70 text-sm">
                        Showing {((currentEmailPage - 1) * EMAILS_PER_PAGE) + 1}-{Math.min(currentEmailPage * EMAILS_PER_PAGE, queueEmails.length)} of {queueEmails.length}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCurrentEmailPage(prev => Math.max(1, prev - 1))}
                          disabled={currentEmailPage === 1}
                          className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white rounded text-sm transition-all"
                        >
                          ← Previous
                        </button>
                        <button
                          onClick={() => setCurrentEmailPage(prev => Math.min(Math.ceil(queueEmails.length / EMAILS_PER_PAGE), prev + 1))}
                          disabled={currentEmailPage >= Math.ceil(queueEmails.length / EMAILS_PER_PAGE)}
                          className="px-3 py-1 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-white/30 text-white rounded text-sm transition-all"
                        >
                          Next →
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2 will-change-transform">
                      {queueEmails
                        .slice((currentEmailPage - 1) * EMAILS_PER_PAGE, currentEmailPage * EMAILS_PER_PAGE)
                        .map((email) => {
                      const emailId = email._id || email.id;
                      const isExpanded = expandedEmailId === emailId;
                      const isEditing = editingEmail?.id === emailId;
                      const isOrphaned = email.agentId === 'orphan';
                      
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
                              <div className="flex items-center gap-2 mb-1">
                                {isOrphaned && (
                                  <span className="text-xs font-semibold bg-red-500/80 text-white px-2 py-0.5 rounded">
                                    ORPHANED
                                  </span>
                                )}
                                {selectedQueue?.type === 'sent' && (
                                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                    email.deliveryStatus === 'delivered' ? 'bg-green-500/80 text-white' :
                                    email.deliveryStatus === 'bounced' ? 'bg-red-500/80 text-white' :
                                    'bg-yellow-500/80 text-white'
                                  }`}>
                                    {email.deliveryStatus === 'delivered' ? '✓ Delivered' :
                                     email.deliveryStatus === 'bounced' ? '✗ Bounced' :
                                     '⏳ Pending'}
                                  </span>
                                )}
                                <div className="font-semibold text-white truncate">{email.subject || 'No Subject'}</div>
                              </div>
                              <div className="text-sm text-white/60 truncate">To: {email.to}</div>
                              {isOrphaned && email.originalAgentId && (
                                <div className="text-xs text-red-400/80 mt-1">
                                  Original agent: {email.originalAgentId}
                                </div>
                              )}
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
                                      {selectedQueue?.type === 'queued' && (
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
                  </>
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
        
        @keyframes progressBar {
          from {
            width: 0%;
          }
          to {
            width: 100%;
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

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] animate-slide-in">
          <div className={`px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-xl ${
            toast.type === 'success' 
              ? 'bg-green-500/20 border-green-500/30 text-green-100' 
              : 'bg-red-500/20 border-red-500/30 text-red-100'
          }`}>
            <div className="flex items-center gap-3">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <p className="font-medium">{toast?.message}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
