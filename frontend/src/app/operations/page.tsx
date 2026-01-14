'use client';

import { useRef, useState, useEffect, useLayoutEffect } from 'react';
import { useRouter } from 'next/navigation';
import { UsersIcon, ComputerDesktopIcon, ChartPieIcon, Cog6ToothIcon, BookOpenIcon, XMarkIcon } from '@heroicons/react/24/outline';
import AppLayout from '@/components/AppLayout';
import AgentDirector from '@/components/AgentDirector';
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
    alerts: 0,
    totalEmailsQueued: 0, // Cumulative total for progress bar
    totalEmailsSent: 0    // Cumulative total for progress bar
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
  const [selectedEmailForView, setSelectedEmailForView] = useState<any | null>(null); // For viewing email details
  const [viewingAiReport, setViewingAiReport] = useState<any | null>(null); // For viewing AI research reports
  const [navigating, setNavigating] = useState(false);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [agents, setAgents] = useState<any[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [currentEmailPage, setCurrentEmailPage] = useState(1);
  const EMAILS_PER_PAGE = 20;
  
  // Auto-editor states
  const [showAutoEditor, setShowAutoEditor] = useState(false);
  const [autoEditFind, setAutoEditFind] = useState('');
  const [autoEditReplace, setAutoEditReplace] = useState('');
  const [autoEditUseRegex, setAutoEditUseRegex] = useState(false);
  const [autoEditLoading, setAutoEditLoading] = useState(false);
  const [autoEditProgress, setAutoEditProgress] = useState('');
  
  // Modal drag and resize states
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ width: 896, height: 600 }); // max-w-4xl = 896px
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState<string>('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  const rafRef = useRef<number | undefined>(undefined);
  const prevShowIdleAgentsRef = useRef(false);

  // Satellite and agent positioning
  const [showIdleAgents, setShowIdleAgents] = useState(false);
  const [satelliteBob, setSatelliteBob] = useState(0);
  const [agentActivities, setAgentActivities] = useState<{[agentId: string]: any}>({});
  const [emailActivity, setEmailActivity] = useState<any[]>([]);
  
  // Tab state for operations view
  const [activeTab, setActiveTab] = useState<'director' | 'queue' | 'globe'>('director');
  const [activityFilter, setActivityFilter] = useState<'all' | 'opened' | 'sent' | 'bounced'>('all');
  const [outreachSearch, setOutreachSearch] = useState('');
  const [outreachPage, setOutreachPage] = useState(0);
  const OUTREACH_PAGE_SIZE = 20;
  
  // Follow-up modal state
  const [followUpModal, setFollowUpModal] = useState<any>(null);
  const [editingFollowUp, setEditingFollowUp] = useState(false);
  const [editFollowUpDate, setEditFollowUpDate] = useState('');
  const [editTemplateId, setEditTemplateId] = useState(0);
  
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

  // Refetch all agents queue when modal closes and "All Agents" is selected
  useEffect(() => {
    console.log('Modal close effect triggered:', {
      prevModalOpen: prevShowIdleAgentsRef.current,
      currentModalOpen: showIdleAgents,
      selectedAgent: selectedAgent,
      selectedQueue: selectedQueue,
      agentsCount: agents.filter(a => a.agentId !== 'orphan').length
    });
    
    // Only run when modal transitions from open to closed
    if (prevShowIdleAgentsRef.current && !showIdleAgents && !selectedAgent && selectedQueue && agents.length > 0) {
      console.log('Refetching all emails for queue:', selectedQueue.type);
      // Refetch all emails when modal closes and we're viewing all agents
      const fetchAllEmails = async () => {
        try {
          const allEmails: any[] = [];
          for (const agent of agents) {
            if (agent.agentId === 'orphan') continue;
            const response = await api.get(`/api/email-queue/${selectedQueue?.type === 'sent' ? 'sent' : selectedQueue?.type === 'replied' ? 'replied' : 'queue'}`, {
              params: { agentId: agent.agentId }
            });
            const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
            console.log(`Agent ${agent.name} returned ${emails.length} emails`);
            allEmails.push(...emails.map((email: any) => ({
              ...email,
              agentName: agent.name
            })));
          }
          console.log(`Total emails fetched: ${allEmails.length}`);
          setQueueEmails(allEmails.sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          ));
        } catch (error) {
          console.error('Error fetching all emails:', error);
        }
      };
      fetchAllEmails();
    }
    // Update the ref for next time
    prevShowIdleAgentsRef.current = showIdleAgents;
  }, [showIdleAgents, selectedAgent, selectedQueue, agents]);

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
        
        // Handle agent stopped event
        if (data.type === 'activity_added' && data.data?.type === 'agent_stopped') {
          const stopData = data.data;
          console.log('🛑 Agent stopped event received:', stopData);
          
          // Clear agent activity
          setAgentActivities(prev => {
            const newActivities = { ...prev };
            delete newActivities[stopData.agentId];
            return newActivities;
          });
          
          // Update agent status to idle
          setAgents(prev => prev.map(agent => 
            agent.agentId === stopData.agentId
              ? { ...agent, status: 'idle', currentActivity: null }
              : agent
          ));
          
          return; // Don't process as normal activity
        }
        
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
      console.log('📧 [EMAIL ACTIVITY] API Response:', response.data);
      if (response.data.success) {
        const emails = response.data.data || [];
        console.log('📧 [EMAIL ACTIVITY] Emails count:', emails.length);
        console.log('📧 [EMAIL ACTIVITY] First 3 emails:', emails.slice(0, 3));
        
        // Sort by sentAt timestamp descending (most recent first)
        const sortedEmails = emails.sort((a: any, b: any) => 
          new Date(b.sentAt || b.timestamp).getTime() - new Date(a.sentAt || a.timestamp).getTime()
        );
        
        console.log('📧 [EMAIL ACTIVITY] Sorted emails (first 3):', sortedEmails.slice(0, 3));
        console.log('📧 [EMAIL ACTIVITY] Analytics status check:');
        sortedEmails.slice(0, 3).forEach((email: any, idx: number) => {
          console.log(`  Email ${idx + 1}:`, {
            to: email.to,
            subject: email.subject?.substring(0, 30),
            opened: email.analyticsStatus?.opened,
            clicked: email.analyticsStatus?.clicked,
            replied: email.analyticsStatus?.replied,
            openCount: email.analyticsStatus?.openCount,
            sentAt: email.sentAt
          });
        });
        
        const slicedEmails = sortedEmails.slice(0, 50);
        console.log('📧 [EMAIL ACTIVITY] Setting state with', slicedEmails.length, 'emails');
        setEmailActivity(slicedEmails); // Keep last 50 emails
        console.log('✅ [EMAIL ACTIVITY] State updated successfully!');
      }
    } catch (err) {
      console.error('❌ [EMAIL ACTIVITY] Error fetching email activity:', err);
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
      const emails = Array.isArray(response.data) ? response.data : [];
      
      // Debug: Log follow-up data for sent emails
      if (type === 'sent' && emails.length > 0) {
        console.log('📅 [FOLLOW-UP DEBUG] Fetched sent emails:', emails.length);
        const emailsWithFollowUp = emails.filter(e => e.followUpScheduled || e.followUpDate);
        console.log('📅 [FOLLOW-UP DEBUG] Emails with follow-up data:', emailsWithFollowUp.length);
        if (emailsWithFollowUp.length > 0) {
          console.log('📅 [FOLLOW-UP DEBUG] Sample email with follow-up:', {
            id: emailsWithFollowUp[0].id,
            followUpScheduled: emailsWithFollowUp[0].followUpScheduled,
            followUpDate: emailsWithFollowUp[0].followUpDate,
            assignedTemplateId: emailsWithFollowUp[0].assignedTemplateId
          });
        }
      }
      
      setQueueEmails(emails);
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
    // Reset loading states immediately
    setLoadingAgents(false);
    setLoadingQueue(false);
    
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
    
    // Optimistic update - remove email immediately from queue
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1),
      emailsSent: prev.emailsSent + 1,
      totalEmailsSent: prev.totalEmailsSent + 1 // Increment cumulative total
    }));
    
    try {
      // For orphaned emails, use the original agent ID from the email or 'orphan'
      const agentIdToUse = selectedAgent.agentId === 'orphan' ? 'orphan' : selectedAgent.agentId;
      
      await api.post(`/api/email-queue/${emailId}/approve`, {
        agentId: agentIdToUse,
        isOrphaned: selectedAgent.agentId === 'orphan'
      });
      showToast('Email sent successfully! 🚀', 'success');
      
      // Refresh sent emails to get the updated data with follow-up info
      // Wait a moment for backend to process
      setTimeout(() => {
        if (selectedQueue.type === 'sent' || selectedAgent) {
          fetchQueueEmails(selectedAgent.agentId, 'sent');
        }
      }, 1000);
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
      // totalEmailsQueued stays the same - rejection doesn't change cumulative total
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

  const handleAcceptEmail = async (emailId: string, agentId: string) => {
    // Optimistic update - remove email immediately from queue
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1),
      emailsSent: prev.emailsSent + 1,
      totalEmailsSent: prev.totalEmailsSent + 1
    }));
    
    // Show immediate feedback
    showToast('Email sent successfully! 🚀', 'success');
    
    try {
      await api.post(`/api/email-queue/${emailId}/approve`, { agentId });
      
      // Refresh sent emails after a moment to get follow-up data
      setTimeout(() => {
        if (selectedQueue?.type === 'sent' || selectedAgent) {
          fetchQueueEmails(selectedAgent?.agentId || agentId, 'sent');
        }
      }, 1000);
    } catch (error) {
      console.error('Error accepting email:', error);
      showToast('Failed to send email', 'error');
      // Revert on error
      fetchQueueEmails(agentId, selectedQueue?.type || 'queued');
      const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
      const sentResponse = await api.get('/api/email-queue/sent?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0,
        emailsSent: Array.isArray(sentResponse.data) ? sentResponse.data.length : 0
      }));
    }
  };

  const handleRejectEmailFromQueue = async (emailId: string, agentId: string) => {
    // Optimistic update - remove email immediately
    setQueueEmails(prev => prev.filter(e => (e._id || e.id) !== emailId));
    setStats(prev => ({
      ...prev,
      emailsQueued: Math.max(0, prev.emailsQueued - 1)
    }));
    
    // Show immediate feedback
    showToast('Email rejected', 'success');
    
    try {
      await api.delete(`/api/email-queue/${emailId}`, {
        data: { agentId }
      });
    } catch (error) {
      console.error('Error rejecting email:', error);
      showToast('Failed to reject email', 'error');
      // Revert on error
      fetchQueueEmails(agentId, selectedQueue?.type || 'queued');
      const queuedResponse = await api.get('/api/email-queue/queue?agentId=all');
      setStats(prev => ({
        ...prev,
        emailsQueued: Array.isArray(queuedResponse.data) ? queuedResponse.data.length : 0
      }));
    }
  };

  const handleBulkEdit = async () => {
    if (!autoEditFind && autoEditFind !== '') {
      alert('Please enter text to find');
      return;
    }
    
    setAutoEditLoading(true);
    setAutoEditProgress('Preparing to edit emails...');
    
    try {
      const response = await api.post('/api/email-queue/bulk-edit', {
        findText: autoEditFind,
        replaceText: autoEditReplace || '',
        useRegex: autoEditUseRegex,
        agentId: selectedAgent?.agentId || 'all'
      });
      
      if (response.data.success) {
        setAutoEditProgress(`✅ Complete! Updated ${response.data.updatedCount} of ${response.data.totalProcessed} emails`);
        
        // Show success message for 2 seconds then close
        setTimeout(() => {
          setShowAutoEditor(false);
          setAutoEditFind('');
          setAutoEditReplace('');
          setAutoEditProgress('');
          
          // Refresh the queue
          if (selectedAgent && selectedQueue) {
            fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
          }
        }, 2000);
      }
    } catch (error: any) {
      console.error('Error in bulk edit:', error);
      setAutoEditProgress('❌ Failed: ' + (error.response?.data?.error || error.message));
      
      // Clear error after 3 seconds
      setTimeout(() => {
        setAutoEditProgress('');
        setAutoEditLoading(false);
      }, 3000);
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

        setStats(prev => ({
          emailsQueued,
          emailsSent,
          emailsViewed,
          alerts,
          // Initialize cumulative totals on first load, otherwise keep existing values
          totalEmailsQueued: Math.max(prev.totalEmailsQueued, emailsQueued),
          totalEmailsSent: Math.max(prev.totalEmailsSent, emailsSent)
        }));
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
    fetchAgents('queued');
    fetchEmailActivity();
    
    // Poll for email activity every 15 seconds
    const interval = setInterval(() => {
      fetchEmailActivity();
    }, 15000);
    
    return () => clearInterval(interval);
  }, []);

  // Fetch all emails from all agents on initial load
  useEffect(() => {
    if (agents.length > 0) {
      console.log('Fetching all emails for agents:', agents.map(a => a.name));
      const fetchAllEmails = async () => {
        try {
          const allEmails: any[] = [];
          for (const agent of agents) {
            // Skip orphan agent - it doesn't have real emails
            if (agent.agentId === 'orphan') continue;
            
            console.log('Fetching emails for agent:', agent.name, agent.agentId);
            try {
              const response = await api.get(`/api/email-queue/queue`, {
                params: { agentId: agent.agentId }
              });
              console.log('Response for', agent.name, ':', response.data);
              const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
              console.log(`Got ${emails.length} emails for ${agent.name}`);
              allEmails.push(...emails.map((email: any) => ({
                ...email,
                agentName: agent.name
              })));
            } catch (err: any) {
              // Skip 404 errors for agents without queues
              if (err?.response?.status !== 404) {
                console.error('Error fetching emails for agent', agent.name, ':', err);
              }
            }
          }
          console.log('Total emails fetched:', allEmails.length);
          setQueueEmails(allEmails.sort((a, b) => 
            new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
          ));
        } catch (error) {
          console.error('Error fetching all emails:', error);
        }
      };
      fetchAllEmails();
    }
  }, [agents.length]);

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
      <AppLayout>
        <div suppressHydrationWarning className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-[#4FD1FF]/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-[#4FD1FF] border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-2xl font-semibold text-white">Loading...</div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-3">
        <h1 className="text-2xl font-bold text-white">Operations</h1>
      </div>

      {/* Top Tabs */}
      <div className="flex items-center gap-2 mb-4 border-b border-[#4FD1FF]/20 pb-2">
        <button
          onClick={() => setActiveTab('director')}
          className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'director'
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-b-2 border-[#4FD1FF]'
              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
          }`}
        >
          Agent Director
        </button>
        <button
          onClick={() => {
            setActiveTab('queue');
            handleGlobeToggle(false);
          }}
          className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'queue'
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-b-2 border-[#4FD1FF]'
              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
          }`}
        >
          Email Queue
        </button>
        <button
          onClick={() => {
            setActiveTab('globe');
            handleGlobeToggle(true);
          }}
          className={`px-4 py-2 rounded-t-lg font-medium text-sm transition-colors ${
            activeTab === 'globe'
              ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border-b-2 border-[#4FD1FF]'
              : 'text-[#8FA6C1] hover:text-white hover:bg-white/5'
          }`}
        >
          Overview
        </button>
      </div>



      {/* Mobile Navigation/Stats - Only show on queue/globe tabs */}
      {(activeTab === 'queue' || activeTab === 'globe') && (
      <div className="sm:fixed relative px-2 pt-10 sm:pt-0 sm:top-6 sm:left-[47%] sm:-translate-x-1/2 sm:right-auto z-50 xl:hidden">
          <div className="flex flex-col gap-2">\n\n            {/* Start/Stop All Toggle Button - Mobile only */}
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
                  setAgents(prev => prev.map(a => a.agentId === 'orphan' ? a : { ...a, status: 'running' }));
                  
                  // Start all (exclude orphan agent)
                  for (const agent of agents) {
                    if (agent.agentId === 'orphan') continue; // Skip orphan placeholder
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
                agents.filter(a => a.agentId !== 'orphan').every(a => a.status === 'running')
                  ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40 hover:border-red-500/60'
                  : 'bg-[#4FD1FF]/20 hover:bg-[#4FD1FF]/30 text-[#4FD1FF] border-[#4FD1FF]/40 hover:border-[#4FD1FF]/60'
              }`}
            >
              {agents.filter(a => a.agentId !== 'orphan').every(a => a.status === 'running') ? 'Stop All Agents' : 'Start All Agents'}
            </button>
          </div>
        </div>
      )}{/* End Mobile Navigation */}

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

      {/* Email Queue Section - Only show on queue tab */}
      {activeTab === 'queue' && (
      <div 
        className="hidden xl:flex fixed left-[265px] lg:right-[calc(20%+10px)] flex-col gap-6 z-30"
        style={{ top: 'calc(8% + 40px)' }}
      >
        {/* Email Activity Log */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm uppercase tracking-wider">Email Queue</h3>
            <div className="flex items-center gap-3">
              {/* Queue Type Dropdown */}
              <select
                value={selectedQueue?.type || 'queued'}
                onChange={(e) => {
                  const newType = e.target.value as 'queued' | 'sent' | 'replied';
                  if (selectedAgent) {
                    setSelectedQueue({ agentId: selectedAgent.agentId, type: newType, agentName: selectedAgent.name });
                    fetchQueueEmails(selectedAgent.agentId, newType);
                  } else {
                    // Fetch all emails for all agents
                    setSelectedQueue({ agentId: 'all', type: newType, agentName: 'All Agents' });
                    const fetchAllEmails = async () => {
                      try {
                        const allEmails: any[] = [];
                        for (const agent of agents) {
                          if (agent.agentId === 'orphan') continue;
                          const endpoint = newType === 'sent' ? 'sent' : newType === 'replied' ? 'replied' : 'queue';
                          const response = await api.get(`/api/email-queue/${endpoint}`, {
                            params: { agentId: agent.agentId }
                          });
                          const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
                          allEmails.push(...emails.map((email: any) => ({
                            ...email,
                            agentName: agent.name
                          })));
                        }
                        setQueueEmails(allEmails.sort((a, b) => 
                          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
                        ));
                      } catch (error) {
                        console.error('Error fetching all emails:', error);
                      }
                    };
                    fetchAllEmails();
                  }
                }}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white text-[10px] rounded border border-white/20 cursor-pointer font-medium"
              >
                <option value="queued">Queued</option>
                <option value="sent">Sent</option>
                <option value="replied">Replied</option>
              </select>
              
              {/* Auto-Editor Button (only for queued) */}
              {selectedQueue?.type === 'queued' && (
                <button
                  onClick={() => setShowAutoEditor(true)}
                  className="px-3 py-1 bg-blue-500/80 hover:bg-blue-600 text-white rounded text-xs border border-blue-400/50 transition-colors font-medium"
                  title="Find and replace text across all queued emails"
                >
                  🔧 Bulk Edit
                </button>
              )}
              
              <span className="text-[10px] text-[#8FA6C1] ml-2">{queueEmails.length} emails</span>
            </div>
          </div>
          
          {/* Agent Filter */}
          <div className="mb-2 mt-3">
            <div className="relative">
              <select
                value={selectedAgent?.agentId || 'all'}
                onChange={(e) => {
                  const agentId = e.target.value;
                  if (agentId === 'all') {
                    setSelectedAgent(null);
                    // Fetch all emails from all agents
                    const fetchAllEmails = async () => {
                      try {
                        const allEmails: any[] = [];
                        for (const agent of agents) {
                          if (agent.agentId === 'orphan') continue;
                          const response = await api.get(`/api/email-queue/${selectedQueue?.type === 'sent' ? 'sent' : selectedQueue?.type === 'replied' ? 'replied' : 'queue'}`, {
                            params: { agentId: agent.agentId }
                          });
                          const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
                          allEmails.push(...emails.map((email: any) => ({
                            ...email,
                            agentName: agent.name
                          })));
                        }
                        setQueueEmails(allEmails.sort((a, b) => 
                          new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
                        ));
                      } catch (error) {
                        console.error('Error fetching all emails:', error);
                      }
                    };
                    fetchAllEmails();
                  } else {
                    const agent = agents.find(a => a.agentId === agentId);
                    if (agent) {
                      setSelectedAgent(agent);
                      fetchQueueEmails(agentId, selectedQueue?.type || 'queued');
                    }
                  }
                }}
                className="w-full px-2 py-1 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-[11px] focus:outline-none focus:border-[#4FD1FF]/40 transition-colors"
              >
                <option value="all">All Agents</option>
                {agents.map(agent => (
                  <option key={agent.agentId} value={agent.agentId}>{agent.name}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="space-y-1.5 h-[700px] overflow-y-auto bg-[#0A1525]/40 rounded p-2">
            {queueEmails.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-12 h-12 bg-[#4FD1FF]/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-[#4FD1FF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <p className="text-[#8FA6C1] text-sm">No emails in {selectedQueue?.type} queue</p>
                <p className="text-[#8FA6C1]/60 text-xs mt-2">{selectedAgent?.name || 'All agents'}</p>
              </div>
            ) : (
              <>
                {(() => {
                  const EMAILS_PER_PAGE = 20;
                  const startIndex = (currentEmailPage - 1) * EMAILS_PER_PAGE;
                  const endIndex = startIndex + EMAILS_PER_PAGE;
                  const totalPages = Math.ceil(queueEmails.length / EMAILS_PER_PAGE);
                  const paginatedEmails = queueEmails.slice(startIndex, endIndex);
                  
                  return (
                    <>
                      {paginatedEmails.map((email, idx) => {
                  const emailId = email._id || email.id;
                  const isExpanded = expandedEmailId === emailId;
                  const hasAiReport = !!email.aiReport;
                  const isOrphaned = email.agentId === 'orphan';
                  const sentDate = email.timestamp ? new Date(email.timestamp) : null;
                  
                  // Debug: Log follow-up data for each email
                  if (selectedQueue?.type === 'sent' && idx === 0) {
                    console.log('📅 [FOLLOW-UP RENDER] First email in sent queue:', {
                      id: emailId,
                      followUpScheduled: email.followUpScheduled,
                      followUpDate: email.followUpDate,
                      hasFollowUpData: !!(email.followUpScheduled && email.followUpDate)
                    });
                  }
                  
                  return (
                    <div 
                      key={emailId || idx} 
                      className="bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20 hover:border-[#4FD1FF]/40 transition-all overflow-hidden"
                    >
                      {/* Collapsed Header */}
                      <div
                        className="p-2.5 cursor-pointer hover:bg-white/5"
                        onClick={() => setExpandedEmailId(isExpanded ? null : emailId)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {isOrphaned && (
                                <span className="text-[10px] font-semibold bg-red-500/80 text-white px-1.5 py-0.5 rounded">
                                  ORPHAN
                                </span>
                              )}
                              {selectedQueue?.type === 'sent' && email.deliveryStatus && (
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                  email.deliveryStatus === 'delivered' ? 'bg-green-500/80 text-white' :
                                  email.deliveryStatus === 'bounced' ? 'bg-red-500/80 text-white' :
                                  'bg-yellow-500/80 text-white'
                                }`}>
                                  {email.deliveryStatus === 'delivered' ? '✓' :
                                   email.deliveryStatus === 'bounced' ? '✗' :
                                   '⏳'}
                                </span>
                              )}
                              {selectedQueue?.type === 'sent' && email.followUpScheduled && email.followUpDate && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    console.log('📅 [FOLLOW-UP BADGE] Clicked on email:', {
                                      id: email.id,
                                      followUpScheduled: email.followUpScheduled,
                                      followUpDate: email.followUpDate,
                                      assignedTemplateId: email.assignedTemplateId
                                    });
                                    setFollowUpModal(email);
                                    setEditFollowUpDate(new Date(email.followUpDate).toISOString().slice(0, 16));
                                    setEditTemplateId(email.assignedTemplateId || 0);
                                    setEditingFollowUp(false);
                                  }}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/80 text-white hover:bg-purple-600/90 transition-colors cursor-pointer"
                                  title={`Follow-up: ${new Date(email.followUpDate).toLocaleString()}`}
                                >
                                  📅 {new Date(email.followUpDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </button>
                              )}
                              <div className="text-white text-[11px] font-medium truncate flex-1">
                                {email.subject || 'No Subject'}
                              </div>
                            </div>
                            <div className="text-[#8FA6C1] text-[11px] truncate mb-1">
                              To: {email.to} {email.agentName && `• ${email.agentName}`}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#8FA6C1]/70">
                              {email.queuedAt && (
                                <span>
                                  Queued: {new Date(email.queuedAt).toLocaleDateString()} {new Date(email.queuedAt).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                </span>
                              )}
                              {sentDate && (
                                <span>
                                  • Sent: {sentDate.toLocaleDateString()} {sentDate.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {hasAiReport && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setViewingAiReport(email.aiReport);
                                }}
                                className="p-1 hover:bg-blue-500/20 rounded border border-blue-400/50 hover:border-blue-400 transition-colors"
                                title="View AI Research Report"
                              >
                                <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedEmailId(emailId);
                                setEditingEmail({
                                  id: emailId,
                                  subject: email.subject || '',
                                  body: email.body || '',
                                  to: email.to || '',
                                  cc: email.cc,
                                  bcc: email.bcc
                                });
                              }}
                              className="p-1 hover:bg-[#4FD1FF]/20 rounded border border-[#4FD1FF]/50 hover:border-[#4FD1FF] transition-colors"
                              title="Edit Email"
                            >
                              <svg className="w-3.5 h-3.5 text-[#4FD1FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <svg 
                              className={`w-3.5 h-3.5 text-[#4FD1FF] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                              fill="none" 
                              stroke="currentColor" 
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="border-t border-[#4FD1FF]/20 p-3 space-y-2.5 bg-[#0A1525]/60">
                          {editingEmail?.id === emailId ? (
                            /* Edit Mode */
                            <>
                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">To</div>
                                <input
                                  type="text"
                                  value={editingEmail?.to || ''}
                                  onChange={(e) => editingEmail && setEditingEmail({...editingEmail, to: e.target.value})}
                                  className="w-full px-2 py-1.5 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-[11px] focus:outline-none focus:border-[#4FD1FF]/40"
                                />
                              </div>
                              
                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">Subject</div>
                                <input
                                  type="text"
                                  value={editingEmail?.subject || ''}
                                  onChange={(e) => editingEmail && setEditingEmail({...editingEmail, subject: e.target.value})}
                                  className="w-full px-2 py-1.5 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-[11px] focus:outline-none focus:border-[#4FD1FF]/40"
                                />
                              </div>

                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">Email Body</div>
                                <textarea
                                  value={editingEmail?.body || ''}
                                  onChange={(e) => editingEmail && setEditingEmail({...editingEmail, body: e.target.value})}
                                  rows={8}
                                  className="w-full px-2 py-1.5 bg-[#0A1525]/80 border border-[#4FD1FF]/20 rounded text-white text-[11px] whitespace-pre-wrap font-mono resize-none focus:outline-none focus:border-[#4FD1FF]/40"
                                />
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEmail(null);
                                  }}
                                  className="px-3 py-1.5 bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/40 text-gray-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  Cancel
                                </button>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!editingEmail) return;
                                    
                                    // Optimistic update - update local state immediately
                                    setQueueEmails(prev => prev.map(em => 
                                      (em._id || em.id) === emailId 
                                        ? { ...em, subject: editingEmail.subject, body: editingEmail.body, to: editingEmail.to, cc: editingEmail.cc, bcc: editingEmail.bcc }
                                        : em
                                    ));
                                    setEditingEmail(null);
                                    
                                    try {
                                      // Use the email's actual agentId instead of selectedAgent
                                      const emailAgentId = email.agentId || selectedAgent?.agentId || 'all';
                                      await api.put(`/api/email-queue/${emailId}?agentId=${emailAgentId}`, {
                                        subject: editingEmail.subject,
                                        body: editingEmail.body,
                                        to: editingEmail.to,
                                        cc: editingEmail.cc,
                                        bcc: editingEmail.bcc
                                      });
                                      showToast('Email updated successfully', 'success');
                                    } catch (error) {
                                      console.error('Error updating email:', error);
                                      showToast('Failed to update email', 'error');
                                      // Revert on error
                                      if (selectedAgent) {
                                        fetchQueueEmails(selectedAgent.agentId, selectedQueue?.type || 'queued');
                                      } else {
                                        // Reload all emails for all agents
                                        try {
                                          const allEmails: any[] = [];
                                          for (const agent of agents) {
                                            if (agent.agentId === 'orphan') continue;
                                            const response = await api.get(`/api/email-queue/${selectedQueue?.type === 'sent' ? 'sent' : selectedQueue?.type === 'replied' ? 'replied' : 'queue'}`, {
                                              params: { agentId: agent.agentId }
                                            });
                                            const emails = Array.isArray(response.data) ? response.data : (response.data.emails || []);
                                            allEmails.push(...emails.map((email: any) => ({
                                              ...email,
                                              agentName: agent.name
                                            })));
                                          }
                                          setQueueEmails(allEmails);
                                        } catch (err) {
                                          console.error('Error reloading emails:', err);
                                        }
                                      }
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/40 text-blue-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </>
                          ) : (
                            /* View Mode */
                            <>
                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">Subject</div>
                                <div className="text-white text-[11px]">{email.subject || 'No subject'}</div>
                              </div>

                              <div>
                                <div className="text-[10px] text-[#8FA6C1] mb-1">Email Body</div>
                                <div className="bg-[#0A1525]/80 rounded p-2.5 text-white/90 text-[11px] whitespace-pre-wrap font-mono max-h-[200px] overflow-y-auto">
                                  {email.body || 'No content'}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAcceptEmail(emailId, email.agentId);
                                  }}
                                  className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  ✓ Accept
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRejectEmailFromQueue(emailId, email.agentId);
                                  }}
                                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 text-[11px] font-medium rounded transition-colors"
                                >
                                  ✗ Reject
                                </button>
                                {email.agentName && (
                                  <span className="text-[10px] text-[#8FA6C1] ml-auto">
                                    {email.agentName}
                                  </span>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-3 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded-lg mt-3">
                    <button
                      onClick={() => setCurrentEmailPage(Math.max(1, currentEmailPage - 1))}
                      disabled={currentEmailPage === 1}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-[#4FD1FF] text-[11px] font-medium"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Previous
                    </button>
                    
                    <span className="text-[#8FA6C1] text-[11px]">
                      Page {currentEmailPage} of {totalPages} ({queueEmails.length} total)
                    </span>
                    
                    <button
                      onClick={() => setCurrentEmailPage(Math.min(totalPages, currentEmailPage + 1))}
                      disabled={currentEmailPage >= totalPages}
                      className="flex items-center gap-2 px-3 py-1.5 bg-[#4FD1FF]/10 hover:bg-[#4FD1FF]/20 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors text-[#4FD1FF] text-[11px] font-medium"
                    >
                      Next
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
                    </>
                  );
                })()}
              </>
            )}
          </div>
        </div>
      </div>
      )}{/* End Email Queue Section */}

      {/* Tab Content */}
      {activeTab === 'queue' && (
        <div className="pt-32">
          {/* Email Queue tab content */}
        </div>
      )}

      {activeTab === 'globe' && (
      <div className="fixed inset-0 lg:right-[20.75%] pointer-events-none">

      {isMounted && (
        <div 
          className={`hidden sm:flex fixed left-[265px] lg:right-[calc(20%+10px)] top-[200px] justify-center transition-all duration-700 ease-out pointer-events-auto ${
            showGlobe || isAnimatingOut ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
        {/* Globe - Hidden on mobile */}
        <div className="text-center relative">
          {/* Globe Canvas */}
          {(showGlobe || isAnimatingOut) && (
            <canvas
              ref={canvasRef}
              className={`cursor-default transition-all duration-500 ${!showGlobe && isAnimatingOut ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
              onClick={handleCanvasClick}
            />
          )}
        </div>
      </div>
      )}

      {/* Email Dots on Globe (color-coded by status) */}
      {showGlobe && !globeLoading && emailDots.map((email) => {
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
      {showGlobe && !globeLoading && agents.filter(a => a.agentId !== 'orphan').map((agent, index) => {
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

      </div>
      )}{/* End Globe Tab */}

      {/* AI Report Modal */}
      {viewingAiReport && (
        <>
          {/* Dark overlay covering everything including sidebar */}
          <div className="fixed inset-0 bg-black/60 z-[199]" onClick={() => setViewingAiReport(null)} />
          
          <div 
            className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none"
          >
            <div 
              className="bg-gradient-to-br from-[#0a1628] via-[#0F1E35] to-[#1a2f4a] rounded-2xl shadow-2xl border border-[#4FD1FF]/30 w-full max-w-4xl max-h-[90%] overflow-hidden flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="relative flex items-start justify-between p-6 border-b border-[#4FD1FF]/20">
              <div className="flex-1">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-white uppercase tracking-wider">Research Report</h3>
                  <p className="text-[#8FA6C1] text-sm mt-1">{viewingAiReport.companyName} • {viewingAiReport.contactName}</p>
                </div>
                
                {/* Quick Stats Bar */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20">
                    <span className="text-xs text-[#8FA6C1]">Score</span>
                    <span className="text-sm font-bold text-[#4FD1FF]">{viewingAiReport.score}/100</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20">
                    <span className="text-xs text-[#8FA6C1]">Confidence</span>
                    <span className="text-sm font-bold text-white">{viewingAiReport.confidence}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A1525]/60 rounded border border-[#4FD1FF]/20">
                    <span className="text-xs text-[#8FA6C1]">Sources</span>
                    <span className="text-sm font-bold text-white">{viewingAiReport.totalSources}</span>
                  </div>
                  <span className={`ml-auto px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider ${
                    viewingAiReport.tier === 'HIGHLY_QUALIFIED' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
                    viewingAiReport.tier === 'QUALIFIED' ? 'bg-[#4FD1FF]/20 text-[#4FD1FF] border border-[#4FD1FF]/40' :
                    viewingAiReport.tier === 'SHOTGUN' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                    'bg-red-500/20 text-red-400 border border-red-500/40'
                  }`}>
                    {viewingAiReport.tier === 'HIGHLY_QUALIFIED' ? 'Highly Qualified' :
                     viewingAiReport.tier === 'QUALIFIED' ? 'Qualified' :
                     viewingAiReport.tier === 'SHOTGUN' ? 'Shotgun' :
                     'Rejected'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => setViewingAiReport(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors ml-4"
              >
                <XMarkIcon className="w-6 h-6 text-white/70" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* AI Analysis with Strengths */}
              <div className="bg-[#0A1525]/60 rounded-lg p-5 border border-[#4FD1FF]/20">
                <h4 className="text-sm font-semibold text-white mb-3 uppercase tracking-wider border-b border-[#4FD1FF]/20 pb-2">
                  Analysis
                </h4>
                <p className="text-[#8FA6C1] text-sm leading-relaxed whitespace-pre-wrap">{viewingAiReport.reasoning}</p>
                
                {/* Strengths inline */}
                {viewingAiReport.keyStrengths && viewingAiReport.keyStrengths.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-[#4FD1FF]/10">
                    <h5 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                      Strengths
                    </h5>
                    <ul className="space-y-2">
                      {viewingAiReport.keyStrengths.map((strength: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-[#8FA6C1] text-xs">
                          <span className="text-[#4FD1FF] mt-0.5">•</span>
                          <span>{strength}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Concerns */}
              {viewingAiReport.weaknesses && viewingAiReport.weaknesses.length > 0 && (
                <div className="bg-[#0A1525]/60 rounded-lg p-4 border border-yellow-500/30">
                  <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider border-b border-yellow-500/20 pb-2">
                    Concerns
                  </h4>
                  <ul className="space-y-2">
                    {viewingAiReport.weaknesses.map((weakness: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 text-[#8FA6C1] text-xs">
                        <span className="text-yellow-400 mt-0.5">•</span>
                        <span>{weakness}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Cited Evidence - Compact Cards */}
              {viewingAiReport.citedEvidence && viewingAiReport.citedEvidence.length > 0 && (
                <div className="bg-[#0A1525]/60 rounded-lg p-4 border border-[#4FD1FF]/20">
                  <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider border-b border-[#4FD1FF]/20 pb-2">
                    Key Evidence
                  </h4>
                  <div className="space-y-2">
                    {viewingAiReport.citedEvidence.map((evidence: any, i: number) => (
                      <div key={i} className="bg-black/20 rounded p-3 border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30 transition-colors">
                        <p className="text-[#8FA6C1] text-xs mb-2 leading-relaxed">{evidence.fact}</p>
                        <a 
                          href={evidence.source} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[10px] text-[#4FD1FF] hover:text-[#4FD1FF]/70 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          <span className="truncate max-w-[250px]">{evidence.source}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Research Sources - Compact List */}
              {viewingAiReport.allCitedFacts && viewingAiReport.allCitedFacts.length > 0 && (
                <div className="bg-[#0A1525]/60 rounded-lg p-4 border border-[#4FD1FF]/20">
                  <h4 className="text-xs font-semibold text-white mb-3 uppercase tracking-wider border-b border-[#4FD1FF]/20 pb-2">
                    All Sources ({(Array.from(new Set(viewingAiReport.allCitedFacts.map((f: any) => f.source))) as string[]).filter(s => s).length})
                  </h4>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {(Array.from(new Set(viewingAiReport.allCitedFacts.map((f: any) => f.source))) as string[])
                      .filter((source) => source)
                      .map((source, i) => {
                        const sourceTitle = viewingAiReport.allCitedFacts.find((f: any) => f.source === source)?.sourceTitle;
                        return (
                          <a
                            key={i}
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 p-2 bg-black/20 rounded hover:bg-black/30 transition-colors border border-[#4FD1FF]/10 hover:border-[#4FD1FF]/30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg className="w-3.5 h-3.5 text-[#4FD1FF] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              {sourceTitle && <div className="text-white text-xs truncate">{sourceTitle}</div>}
                              <div className="text-[#8FA6C1] text-[10px] truncate">{source}</div>
                            </div>
                          </a>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Metadata Footer */}
              <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-[10px] text-white/40">
                <div className="flex items-center justify-between">
                  <span>Evaluated: {new Date(viewingAiReport.evaluatedAt).toLocaleString()}</span>
                  <span className="px-2 py-1 bg-white/5 rounded">Quality: {viewingAiReport.researchQuality}</span>
                </div>
              </div>
            </div>
          </div>
          </div>
        </>
      )}

      {/* Follow-up Modal */}
      {followUpModal && (
        <>
          <div className="fixed inset-0 bg-black/60 z-[199]" onClick={() => setFollowUpModal(null)} />
          
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 pointer-events-none">
            <div 
              className="bg-gradient-to-br from-[#0a1628] via-[#0F1E35] to-[#1a2f4a] rounded-2xl shadow-2xl border border-[#4FD1FF]/30 w-full max-w-2xl overflow-hidden flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-[#4FD1FF]/20">
                <div>
                  <h3 className="text-lg font-semibold text-white">Follow-up Details</h3>
                  <p className="text-[#8FA6C1] text-sm mt-1">To: {followUpModal.to}</p>
                </div>
                <button
                  onClick={() => setFollowUpModal(null)}
                  className="text-[#8FA6C1] hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Follow-up Date */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Scheduled Follow-up Date
                  </label>
                  {editingFollowUp ? (
                    <input
                      type="datetime-local"
                      value={editFollowUpDate}
                      onChange={(e) => setEditFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm focus:border-[#4FD1FF]/50 focus:outline-none"
                    />
                  ) : (
                    <div className="px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm">
                      {followUpModal.followUpDate 
                        ? new Date(followUpModal.followUpDate).toLocaleString()
                        : 'Not scheduled'}
                    </div>
                  )}
                </div>

                {/* Template */}
                <div>
                  <label className="block text-sm font-medium text-white mb-2">
                    Assigned Template
                  </label>
                  {editingFollowUp && agents.length > 0 ? (
                    <select
                      value={editTemplateId}
                      onChange={(e) => setEditTemplateId(parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded text-white text-sm focus:border-[#4FD1FF]/50 focus:outline-none"
                    >
                      {agents.find((a: any) => a.agentId === followUpModal.agentId)?.settings?.followUpTemplates?.templates?.map((template: any, idx: number) => (
                        <option key={idx} value={idx}>{template.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-3 py-2 bg-[#0A1525]/60 border border-[#4FD1FF]/20 rounded">
                      <div className="text-white text-sm font-medium mb-2">
                        {followUpModal.assignedTemplate?.name || 'No template assigned'}
                      </div>
                      {followUpModal.assignedTemplate && (
                        <>
                          <div className="text-[#8FA6C1] text-xs mb-1">
                            Subject: {followUpModal.assignedTemplate.subject}
                          </div>
                          <div className="text-[#8FA6C1] text-xs whitespace-pre-wrap">
                            {followUpModal.assignedTemplate.body}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-[#4FD1FF]/20">
                <div className="text-xs text-[#8FA6C1]">
                  Scheduled: {followUpModal.followUpScheduledAt 
                    ? new Date(followUpModal.followUpScheduledAt).toLocaleDateString()
                    : 'N/A'}
                </div>
                <div className="flex gap-3">
                  {editingFollowUp ? (
                    <>
                      <button
                        onClick={() => setEditingFollowUp(false)}
                        className="px-4 py-2 text-sm text-[#8FA6C1] hover:text-white transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            await api.put(`/api/email-queue/${followUpModal.id}/followup`, {
                              agentId: followUpModal.agentId,
                              templateId: editTemplateId,
                              followUpDate: editFollowUpDate ? new Date(editFollowUpDate).toISOString() : null
                            });
                            showToast('Follow-up updated', 'success');
                            setFollowUpModal(null);
                            setEditingFollowUp(false);
                            if (selectedQueue && selectedAgent) {
                              fetchQueueEmails(selectedAgent.agentId, selectedQueue.type);
                            }
                          } catch (error) {
                            console.error('Error updating follow-up:', error);
                            showToast('Failed to update follow-up', 'error');
                          }
                        }}
                        className="px-4 py-2 bg-[#4FD1FF] hover:bg-[#3FB8E8] text-black font-medium rounded text-sm transition-colors"
                      >
                        Save Changes
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setEditingFollowUp(true)}
                      className="px-4 py-2 bg-[#4FD1FF] hover:bg-[#3FB8E8] text-black font-medium rounded text-sm transition-colors"
                    >
                      Edit Follow-up
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </AppLayout>
  );
} 
