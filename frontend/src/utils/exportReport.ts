import jsPDF from 'jspdf';
import { ThreatGraphNode, ThreatGraphLink } from '../components/ThreatGraph';
import { generateEvidentiarySeal } from './cryptoSeal';

interface ReportMetadata {
  caseId: string;
  investigatorName: string;
  suspectWallet: string;
  generatedAt: string;
  alerts: any[];
}

export async function exportForensicReport(
  canvasElement: HTMLCanvasElement | null,
  nodes: ThreatGraphNode[],
  links: ThreatGraphLink[],
  metadata: ReportMetadata
) {
  if (!canvasElement) {
    alert("Graph canvas not found.");
    return;
  }

  // Phase 4: Generate Cryptographic Evidentiary Seal
  const seal = await generateEvidentiarySeal(
    metadata.caseId,
    metadata.suspectWallet,
    nodes.length,
    links.length,
    metadata.investigatorName
  );

  // Initialize PDF
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  
  // 1. Header
  pdf.setFillColor(30, 41, 59); // Slate 800
  pdf.rect(0, 0, pageWidth, 40, 'F');
  
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(20);
  pdf.setFont('helvetica', 'bold');
  pdf.text('FORENSIC INTELLIGENCE REPORT', 15, 18);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Section 94 BNSS / Section 91 CrPC Production Order Support`, 15, 26);
  
  pdf.setFontSize(8);
  pdf.setTextColor(148, 163, 184); // Slate 400
  pdf.text(`SEAL ID: ${seal.sealId} | SHA-256: ${seal.hash.slice(0, 24)}...`, 15, 34);
  
  // 2. Metadata Section
  pdf.setTextColor(0, 0, 0);
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('CASE DETAILS & INVESTIGATION CONTEXT', 15, 52);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Case Identifier: ${metadata.caseId}`, 15, 60);
  pdf.text(`Investigating Officer / Unit: ${metadata.investigatorName}`, 15, 66);
  pdf.text(`Ledger Timestamp: ${metadata.generatedAt}`, 15, 72);
  pdf.text(`Primary Suspect Target Wallet: ${metadata.suspectWallet}`, 15, 78);
  pdf.text(`Indexed Ledger Scope: ${nodes.length} Network Nodes, ${links.length} Fund Traversal Hops`, 15, 84);

  // 3. Graph Snapshot
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('ON-CHAIN THREAT GRAPH TOPOLOGY', 15, 100);
  
  // Convert canvas to image and add to PDF
  const imgData = canvasElement.toDataURL('image/png', 1.0);
  
  // Calculate aspect ratio to fit width
  const imgWidth = pageWidth - 30; // 15mm padding on each side
  const imgHeight = (canvasElement.height * imgWidth) / canvasElement.width;
  
  pdf.addImage(imgData, 'PNG', 15, 105, imgWidth, Math.min(imgHeight, 130));
  
  // 4. Detected Patterns / Alerts
  let yPos = 105 + Math.min(imgHeight, 130) + 12;
  if (yPos > 260) {
    pdf.addPage();
    yPos = 20;
  }
  
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('DETECTED LAUNDERING & BEHAVIORAL PATTERNS', 15, yPos);
  
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  yPos += 8;
  
  if (metadata.alerts.length === 0) {
    pdf.text('No automated laundering patterns detected in indexed window.', 15, yPos);
    yPos += 8;
  } else {
    metadata.alerts.forEach((alert) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`[${alert.severity.toUpperCase()}] ${alert.type}`, 15, yPos);
      yPos += 5;
      
      pdf.setFont('helvetica', 'normal');
      const splitDesc = pdf.splitTextToSize(alert.description, pageWidth - 30);
      pdf.text(splitDesc, 15, yPos);
      yPos += (splitDesc.length * 4.5) + 4;
      
      if (yPos > 270) {
        pdf.addPage();
        yPos = 20;
      }
    });
  }
  
  // 5. Node summary
  pdf.addPage();
  pdf.setFontSize(12);
  pdf.setFont('helvetica', 'bold');
  pdf.text('KEY ENTITIES & ASSET CONCENTRATION', 15, 20);
  
  let entityY = 28;
  pdf.setFontSize(8.5);
  pdf.setFont('helvetica', 'normal');
  const sortedNodes = [...nodes].sort((a, b) => b.riskScore - a.riskScore).slice(0, 15);
  
  sortedNodes.forEach(node => {
    const taintStr = node.taintPercentage ? ` | Taint: ${Math.round(node.taintPercentage)}%` : '';
    const txt = `${node.address.substring(0, 16)}... | Type: ${node.type.toUpperCase()} | Risk: ${node.riskScore}/100 | Bal: ${node.balanceNative.toFixed(3)} ${node.balanceCurrency}${taintStr}`;
    pdf.text(txt, 15, entityY);
    entityY += 5.5;
  });

  // 6. Phase 4: Cryptographic Evidentiary Certificate Box
  entityY += 10;
  if (entityY > 210) {
    pdf.addPage();
    entityY = 25;
  }

  pdf.setFillColor(248, 250, 252); // Slate 50
  pdf.setDrawColor(203, 213, 225); // Slate 300
  pdf.rect(15, entityY, pageWidth - 30, 68, 'FD');

  pdf.setTextColor(15, 23, 42); // Slate 900
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.text('EVIDENTIARY INTEGRITY CERTIFICATE (BNSS SEC. 63 / EVIDENCE ACT SEC. 65B)', 20, entityY + 9);

  pdf.setFontSize(8);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(71, 85, 105); // Slate 600

  const certLines = pdf.splitTextToSize(seal.legalCertificate, pageWidth - 40);
  pdf.text(certLines, 20, entityY + 16);

  const hashBoxY = entityY + 16 + (certLines.length * 4) + 2;
  pdf.setFont('courier', 'bold');
  pdf.setFontSize(7.5);
  pdf.setTextColor(30, 41, 59);
  pdf.text(`CANONICAL SHA-256 DIGEST: ${seal.hash}`, 20, hashBoxY);
  pdf.text(`SEAL REGISTRATION ID:   ${seal.sealId}`, 20, hashBoxY + 5);
  pdf.text(`ALGORITHM SPECIFICATION: ${seal.algorithm}`, 20, hashBoxY + 10);
  pdf.text(`TIMESTAMP OF SEALING:    ${seal.timestamp}`, 20, hashBoxY + 15);

  pdf.setFont('helvetica', 'italic');
  pdf.setFontSize(7);
  pdf.setTextColor(100, 116, 139);
  pdf.text('This digital certificate verifies cryptographic authenticity. Any tampering with graph nodes or transactions invalidates this hash.', 20, hashBoxY + 22);

  // Save PDF
  pdf.save(`CryptoTrace_Court_Dossier_${metadata.caseId}.pdf`);
}

