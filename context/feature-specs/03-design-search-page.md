## Goal
Revamp the Desing and functionality of search page to make it accessible to the user and easy to navigate.

## Design
- Should look very simirlar to what Getty has done ![alt text](image.png), but without copying them directly. We should maintain our brand identity. 
- The image Grid, each image should have sharp borders instead of curve
- reduce the padding on the left and right on the image grid
- Implement the proper filtering system ![alt text](image-1.png), refer getty's but build it for our business case and requirements.
- Use proper Colors for highlighting active elements, important elements refer @ui-context.md file and @globals.css file
- Have 2 views, Grid view and card view ![alt text](image-4.png)![![alt text](image-6.png)](image-5.png)
- Default view is the grid View
- Hover only active when in Grid View
- On hover remove the 'Preview' Text
- On hover remove the black text that was on the bottom left and remove the lock icon from the top right


## Checklist
- We have a Search page, very similar to the Getty's with our own brand idenity
- we have a proper filtering system 
- user can choose between Different Views, Grid or full![alt text](image-2.png) refer this![alt text](image-3.png)
- Shows proper Events and images based on search
- Does not copy exactly as shown in the reference image, since most of the designs are not applicable to our use case.
- Have proper lazy loading for images
- On Hover in grid view, the images shows Title and small description of the image / event on the top left
- On Hover in grid view, show Save button on the bottom right