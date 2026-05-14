/**
 * Generate app icons for Android and iOS from the SVG source.
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG_PATH = path.join(__dirname, '../assets/icon.svg');

// Android mipmap sizes
const ANDROID_SIZES = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

// iOS icon sizes
const IOS_SIZES = [
  { name: 'icon-20@2x', size: 40 },
  { name: 'icon-20@3x', size: 60 },
  { name: 'icon-29@2x', size: 58 },
  { name: 'icon-29@3x', size: 87 },
  { name: 'icon-40@2x', size: 80 },
  { name: 'icon-40@3x', size: 120 },
  { name: 'icon-60@2x', size: 120 },
  { name: 'icon-60@3x', size: 180 },
  { name: 'icon-76', size: 76 },
  { name: 'icon-76@2x', size: 152 },
  { name: 'icon-83.5@2x', size: 167 },
  { name: 'icon-1024', size: 1024 },
];

async function generateAndroidIcons() {
  console.log('Generating Android icons...');
  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const { name, size } of ANDROID_SIZES) {
    const outputDir = path.join(__dirname, `../android/app/src/main/res/${name}`);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'ic_launcher.png');
    await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);

    // Round icon
    const roundPath = path.join(outputDir, 'ic_launcher_round.png');
    const roundedBuffer = await sharp(svgBuffer).resize(size, size).png().toBuffer();
    // For round icons, we just use the same (the SVG already has rounded corners)
    await sharp(roundedBuffer).toFile(roundPath);

    console.log(`  ✓ ${name}: ${size}x${size}`);
  }
}

async function generateIOSIcons() {
  console.log('Generating iOS icons...');
  const svgBuffer = fs.readFileSync(SVG_PATH);
  const outputDir = path.join(__dirname, '../ios/Task_Manager/Images.xcassets/AppIcon.appiconset');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const images = [];

  for (const { name, size } of IOS_SIZES) {
    const filename = `${name}.png`;
    const outputPath = path.join(outputDir, filename);
    await sharp(svgBuffer).resize(size, size).png().toFile(outputPath);
    console.log(`  ✓ ${name}: ${size}x${size}`);

    images.push({
      filename,
      idiom: size === 1024 ? 'ios-marketing' : (size <= 87 ? 'iphone' : 'universal'),
      platform: 'ios',
      size: `${size}x${size}`,
    });
  }

  // Write Contents.json
  const contents = {
    images: [
      {
        filename: 'icon-1024.png',
        idiom: 'universal',
        platform: 'ios',
        size: '1024x1024',
      },
    ],
    info: {
      author: 'xcode',
      version: 1,
    },
  };

  fs.writeFileSync(path.join(outputDir, 'Contents.json'), JSON.stringify(contents, null, 2));
}

async function main() {
  try {
    await generateAndroidIcons();
    await generateIOSIcons();
    console.log('\n✅ All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

main();
