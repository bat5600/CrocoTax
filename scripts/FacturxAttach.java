import java.io.File;
import java.io.FileInputStream;
import java.util.HashMap;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.cos.COSArray;
import org.apache.pdfbox.cos.COSName;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDDocumentCatalog;
import org.apache.pdfbox.pdmodel.PDDocumentNameDictionary;
import org.apache.pdfbox.pdmodel.PDEmbeddedFilesNameTreeNode;
import org.apache.pdfbox.pdmodel.PageMode;
import org.apache.pdfbox.pdmodel.common.filespecification.PDComplexFileSpecification;
import org.apache.pdfbox.pdmodel.common.filespecification.PDEmbeddedFile;
import org.apache.pdfbox.pdmodel.interactive.documentnavigation.destination.PDPageDestination;
import org.apache.pdfbox.pdmodel.graphics.color.PDOutputIntent;

public class FacturxAttach {
  public static void main(String[] args) throws Exception {
    if (args.length < 4) {
      System.err.println("Usage: FacturxAttach <inputPdf> <xmlPath> <outputPdf> <iccPath>");
      System.exit(1);
    }

    String inputPdf = args[0];
    String xmlPath = args[1];
    String outputPdf = args[2];
    String iccPath = args[3];

    try (PDDocument doc = Loader.loadPDF(new File(inputPdf))) {
      PDDocumentCatalog catalog = doc.getDocumentCatalog();

      // Attach XML file with AFRelationship=Data
      PDComplexFileSpecification fs = new PDComplexFileSpecification();
      fs.setFile("facturx.xml");
      fs.setFileUnicode("facturx.xml");
      fs.setFileDescription("Factur-X XML");

      try (FileInputStream xmlStream = new FileInputStream(xmlPath)) {
        PDEmbeddedFile ef = new PDEmbeddedFile(doc, xmlStream);
        ef.setSubtype("application/xml");
        ef.setSize((int) new File(xmlPath).length());
        fs.setEmbeddedFile(ef);
        fs.setEmbeddedFileUnicode(ef);
      }

      fs.getCOSObject().setName("AFRelationship", "Data");

      PDEmbeddedFilesNameTreeNode efTree = new PDEmbeddedFilesNameTreeNode();
      Map<String, PDComplexFileSpecification> nameMap = new HashMap<>();
      nameMap.put("facturx.xml", fs);
      efTree.setNames(nameMap);
      catalog.setNames(catalog.getNames() == null ? new PDDocumentNameDictionary(catalog) : catalog.getNames());
      catalog.getNames().setEmbeddedFiles(efTree);

      COSArray afArray = new COSArray();
      afArray.add(fs.getCOSObject());
      catalog.getCOSObject().setItem(COSName.AF, afArray);

      // Ensure OutputIntent for PDF/A
      if (catalog.getOutputIntents().isEmpty()) {
        try (FileInputStream iccStream = new FileInputStream(iccPath)) {
          PDOutputIntent oi = new PDOutputIntent(doc, iccStream);
          oi.setInfo("sRGB IEC61966-2.1");
          oi.setOutputCondition("sRGB IEC61966-2.1");
          oi.setOutputConditionIdentifier("sRGB IEC61966-2.1");
          oi.setRegistryName("http://www.color.org");
          catalog.addOutputIntent(oi);
        }
      }

      catalog.setPageMode(PageMode.USE_ATTACHMENTS);

      doc.save(outputPdf);
    }
  }
}
